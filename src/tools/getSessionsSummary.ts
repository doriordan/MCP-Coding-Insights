import { defaultDateRange, filterEntriesByDateRange, getProjectDirs, loadSessionsIndex, parseSessionsFromIndex } from '../transcripts.js'
import type { SessionSummary } from '../types.js'

export const SESSION_SUMMARY_FIELDS = ['sessionId', 'project', 'gitBranch', 'startedAt', 'endedAt', 'firstPrompt', 'messageCount'] as const
export type SessionSummaryField = typeof SESSION_SUMMARY_FIELDS[number]

interface Params {
  from?: string
  to?: string
  project?: string
  fields?: SessionSummaryField[]
}

export function buildSessionsSummary(params: Params): (SessionSummary | Partial<SessionSummary>)[] {
  const { from, to } = { ...defaultDateRange(), ...params }
  const projectFilter = params.project?.toLowerCase()

  const projects = getProjectDirs()
    .filter(p => !projectFilter || p.name.toLowerCase().includes(projectFilter))

  const all: SessionSummary[] = []

  for (const { name, dirPath } of projects) {
    const index = loadSessionsIndex(dirPath)
    if (!index) continue
    all.push(...parseSessionsFromIndex(name, filterEntriesByDateRange(index.entries, from, to)))
  }

  const sorted = all.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  if (!params.fields) return sorted
  return sorted.map(s => Object.fromEntries(params.fields!.map(f => [f, s[f]])) as Partial<SessionSummary>)
}
