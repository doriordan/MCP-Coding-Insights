import { defaultDateRange, filterEntriesByDateRange, getProjectDirs, loadSessionsIndex, parseDetailFromJsonl, parseSessionsFromIndex } from '../transcripts.js'
import type { SessionDetail } from '../types.js'

export const SESSION_DETAIL_FIELDS = ['sessionId', 'project', 'gitBranch', 'startedAt', 'endedAt', 'firstPrompt', 'messageCount', 'userMessages', 'toolsUsed', 'subagents'] as const
export type SessionDetailField = typeof SESSION_DETAIL_FIELDS[number]

interface Params {
  from?: string
  to?: string
  project?: string
  sessionId?: string
  fields?: SessionDetailField[]
}

function projectFields(detail: SessionDetail, fields: SessionDetailField[]): Partial<SessionDetail> {
  return Object.fromEntries(fields.map(f => [f, detail[f]])) as Partial<SessionDetail>
}

export async function buildSessionLogs(params: Params): Promise<Record<string, (SessionDetail | Partial<SessionDetail>)[]>> {
  const { from, to } = { ...defaultDateRange(), ...params }
  const projectFilter = params.project?.toLowerCase()

  const projects = getProjectDirs()
    .filter(p => !projectFilter || p.name.toLowerCase().includes(projectFilter))

  const grouped: Record<string, (SessionDetail | Partial<SessionDetail>)[]> = {}

  for (const { name, dirPath } of projects) {
    const index = loadSessionsIndex(dirPath)
    if (!index) continue

    const entries = params.sessionId ? index.entries : filterEntriesByDateRange(index.entries, from, to)
    let summaries = parseSessionsFromIndex(name, entries)
    if (params.sessionId) summaries = summaries.filter(s => s.sessionId === params.sessionId)
    if (summaries.length === 0) continue

    const dateRange = (params.from || params.to) ? { from, to } : undefined
    const details = await Promise.all(
      summaries.map(s => {
        const entry = index.entries.find(e => e.sessionId === s.sessionId)
        return parseDetailFromJsonl(name, s, entry?.fullPath ?? '', dateRange)
      })
    )

    const sorted = details.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    grouped[name] = params.fields ? sorted.map(d => projectFields(d, params.fields!)) : sorted
  }

  return grouped
}
