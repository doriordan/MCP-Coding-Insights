import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import type { IndexEntry, SessionDetail, SessionSummary, SessionsIndex, SubagentSummary, SubagentDetail, UserMessage, ToolUse } from './types.js'

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')

export function decodeProjectName(dirName: string): string {
  const parts = dirName.replace(/^-/, '').split('-')
  const repoIdx = parts.lastIndexOf('repo')
  if (repoIdx !== -1 && repoIdx < parts.length - 1) {
    return parts.slice(repoIdx + 1).join('-')
  }
  return parts[parts.length - 1]
}

export function getProjectDirs(): Array<{ name: string; dirPath: string }> {
  if (!fs.existsSync(PROJECTS_DIR)) return []
  return fs.readdirSync(PROJECTS_DIR)
    .filter(d => {
      const full = path.join(PROJECTS_DIR, d)
      return fs.statSync(full).isDirectory()
    })
    .map(d => ({ name: decodeProjectName(d), dirPath: path.join(PROJECTS_DIR, d) }))
}

export function loadSessionsIndex(dirPath: string): SessionsIndex | null {
  const indexPath = path.join(dirPath, 'sessions-index.json')
  if (fs.existsSync(indexPath)) {
    try {
      return JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as SessionsIndex
    } catch {
      return null
    }
  }
  return buildIndexFromJsonlFilesSync(dirPath)
}

function buildIndexFromJsonlFilesSync(dirPath: string): SessionsIndex | null {
  let files: string[]
  try {
    files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'))
  } catch {
    return null
  }
  if (files.length === 0) return null

  const entries: IndexEntry[] = []

  for (const file of files) {
    const fullPath = path.join(dirPath, file)
    let content: string
    try {
      content = fs.readFileSync(fullPath, 'utf-8')
    } catch {
      continue
    }

    const lines = content.split('\n').filter(l => l.trim())
    if (lines.length === 0) continue

    let sessionId = ''
    let gitBranch = 'unknown'
    let isSidechain = false
    let projectPath = ''
    let created = ''
    let modified = ''
    let firstPrompt = 'No prompt'
    let messageCount = 0
    let gotFirst = false

    for (const line of lines) {
      try {
        const record = JSON.parse(line)
        const ts: string = record.timestamp ?? ''

        if (!gotFirst) {
          sessionId = record.sessionId ?? path.basename(file, '.jsonl')
          gitBranch = record.gitBranch ?? 'unknown'
          isSidechain = record.isSidechain ?? false
          projectPath = record.cwd ?? ''
          gotFirst = true
        }

        if (!created && ts) created = ts
        if (ts > modified) modified = ts

        const msg = record.message ?? {}
        if (msg.role === 'user' && firstPrompt === 'No prompt') {
          const msgContent = msg.content
          let text = ''
          if (Array.isArray(msgContent)) {
            for (const block of msgContent) {
              if (block?.type === 'text') text += (block.text as string)
            }
          } else if (typeof msgContent === 'string') {
            text = msgContent
          }
          text = stripSystemInjections(text)
          if (text) firstPrompt = text
        }

        messageCount++
      } catch {
        // skip malformed lines
      }
    }

    if (!sessionId) continue

    entries.push({
      sessionId,
      fullPath,
      firstPrompt,
      summary: '',
      messageCount,
      created,
      modified,
      gitBranch,
      projectPath,
      isSidechain,
    })
  }

  if (entries.length === 0) return null
  return { version: 1, entries }
}

export function parseSessionsFromIndex(project: string, entries: IndexEntry[]): SessionSummary[] {
  return entries
    .filter(e => !e.isSidechain)
    .map(e => ({
      sessionId: e.sessionId,
      project,
      gitBranch: e.gitBranch ?? 'unknown',
      startedAt: e.created,
      endedAt: e.modified,
      firstPrompt: stripSystemInjections(e.firstPrompt ?? ''),
      messageCount: e.messageCount,
    }))
}

function dateRangeToMs(from: string, to: string): { fromMs: number; toMs: number } {
  const fromMs = new Date(from).getTime()
  const toDate = new Date(to)
  if (to.length === 10) toDate.setUTCHours(23, 59, 59, 999)
  return { fromMs, toMs: toDate.getTime() }
}

export function filterEntriesByDateRange(
  entries: IndexEntry[],
  from: string,
  to: string,
): IndexEntry[] {
  const { fromMs, toMs } = dateRangeToMs(from, to)
  return entries.filter(e => {
    const startMs = new Date(e.created).getTime()
    const endMs = new Date(e.modified).getTime()
    return startMs <= toMs && endMs >= fromMs
  })
}

export function filterByDateRange<T extends { startedAt: string }>(
  sessions: T[],
  from: string,
  to: string,
): T[] {
  const { fromMs, toMs } = dateRangeToMs(from, to)
  return sessions.filter(s => {
    const ms = new Date(s.startedAt).getTime()
    return ms >= fromMs && ms <= toMs
  })
}

export function stripSystemInjections(text: string): string {
  return text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim()
}

export async function parseDetailFromJsonl(
  project: string,
  summary: SessionSummary,
  jsonlPath: string,
  dateRange?: { from: string; to: string },
): Promise<SessionDetail> {
  const userMessages: UserMessage[] = []
  const assistantMessages: UserMessage[] = []
  const toolsUsed: ToolUse[] = []
  let endedAt = summary.startedAt

  const range = dateRange ? dateRangeToMs(dateRange.from, dateRange.to) : undefined

  let content: string
  try {
    content = await fsp.readFile(jsonlPath, 'utf-8')
  } catch {
    return { ...summary, endedAt, userMessages, assistantMessages, toolsUsed: [] }
  }

  for (const line of content.split('\n')) {
    if (!line.trim()) continue
    try {
      const record = JSON.parse(line)
      const ts: string = record.timestamp ?? ''
      if (ts > endedAt) endedAt = ts

      const tsMs = ts ? new Date(ts).getTime() : undefined
      const inRange = !range || (!!tsMs && tsMs >= range.fromMs && tsMs <= range.toMs)

      const msg = record.message ?? {}
      if (inRange && msg.role === 'user') {
        const msgContent = msg.content
        let text = ''
        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (block?.type === 'text') text += block.text
          }
        } else if (typeof msgContent === 'string') {
          text = msgContent
        }
        text = stripSystemInjections(text)
        if (text) userMessages.push({ text, timestamp: ts })
      }

      if (inRange && msg.role === 'assistant' && Array.isArray(msg.content)) {
        let text = ''
        for (const block of msg.content) {
          if (block?.type === 'text') text += block.text
          if (block?.type === 'tool_use' && block.name) {
            toolsUsed.push({ name: block.name as string, timestamp: ts })
          }
        }
        text = stripSystemInjections(text)
        if (text) assistantMessages.push({ text, timestamp: ts })
      }
    } catch {
      // skip malformed lines
    }
  }

  const sessionDir = jsonlPath.replace(/\.jsonl$/, '')
  const subagents = await loadSubagentSummaries(sessionDir)

  return {
    ...summary,
    endedAt,
    userMessages,
    assistantMessages,
    toolsUsed,
    subagents,
  }
}

export async function loadSubagentSummaries(sessionDir: string): Promise<SubagentSummary[]> {
  const subagentsDir = path.join(sessionDir, 'subagents')

  let files: string[]
  try {
    files = (await fsp.readdir(subagentsDir)).filter(f => /^agent-.*\.jsonl$/.test(f))
  } catch {
    return []
  }

  const summaries: SubagentSummary[] = []

  for (const file of files) {
    const fullPath = path.join(subagentsDir, file)
    let content: string
    try {
      content = await fsp.readFile(fullPath, 'utf-8')
    } catch {
      continue
    }

    const lines = content.split('\n').filter(l => l.trim())
    if (lines.length === 0) continue

    let agentId = ''
    let slug = ''
    let sessionId = ''
    let firstPrompt = ''
    let messageCount = 0
    const toolsUsed = new Set<string>()

    for (const line of lines) {
      try {
        const record = JSON.parse(line)
        if (!agentId) {
          agentId = record.agentId ?? ''
          slug = record.slug ?? ''
          sessionId = record.sessionId ?? ''
        }

        const msg = record.message ?? {}
        if (msg.role === 'user' && !firstPrompt) {
          const c = msg.content
          if (typeof c === 'string') firstPrompt = stripSystemInjections(c)
          else if (Array.isArray(c)) {
            for (const block of c) {
              if (block?.type === 'text') firstPrompt += block.text
            }
            firstPrompt = stripSystemInjections(firstPrompt)
          }
        }

        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block?.type === 'tool_use' && block.name) toolsUsed.add(block.name as string)
          }
        }

        messageCount++
      } catch {
        // skip malformed lines
      }
    }

    if (!agentId) continue
    summaries.push({ agentId, slug, sessionId, firstPrompt, messageCount, toolsUsed: Array.from(toolsUsed).sort() })
  }

  return summaries
}

export async function loadSubagentDetail(filePath: string): Promise<SubagentDetail | null> {
  let content: string
  try {
    content = await fsp.readFile(filePath, 'utf-8')
  } catch {
    return null
  }

  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length === 0) return null

  let agentId = ''
  let slug = ''
  let sessionId = ''
  let firstPrompt = ''
  let startedAt = ''
  let endedAt = ''
  let messageCount = 0
  const userMessages: string[] = []
  const toolsUsed = new Set<string>()

  for (const line of lines) {
    try {
      const record = JSON.parse(line)
      const ts: string = record.timestamp ?? ''

      if (!agentId) {
        agentId = record.agentId ?? ''
        slug = record.slug ?? ''
        sessionId = record.sessionId ?? ''
      }
      if (!startedAt && ts) startedAt = ts
      if (ts > endedAt) endedAt = ts

      const msg = record.message ?? {}
      if (msg.role === 'user') {
        const c = msg.content
        let text = ''
        if (typeof c === 'string') text = c
        else if (Array.isArray(c)) {
          for (const block of c) {
            if (block?.type === 'text') text += block.text
          }
        }
        text = stripSystemInjections(text)
        if (text) {
          if (!firstPrompt) firstPrompt = text
          userMessages.push(text)
        }
      }

      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block?.type === 'tool_use' && block.name) toolsUsed.add(block.name as string)
        }
      }

      messageCount++
    } catch {
      // skip malformed lines
    }
  }

  if (!agentId) return null
  return {
    agentId, slug, sessionId, firstPrompt, messageCount,
    startedAt, endedAt, userMessages,
    toolsUsed: Array.from(toolsUsed).sort(),
  }
}

export function defaultDateRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 7)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}
