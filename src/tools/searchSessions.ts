import {
  defaultDateRange,
  getProjectDirs,
  loadSessionsIndex,
  filterEntriesByDateRange,
  parseDetailFromJsonl,
} from '../transcripts.js'
import type { MessageMatch, SearchResult, SessionSummary } from '../types.js'

interface SearchSessionsParams {
  query: string
  from?: string
  to?: string
  project?: string
  maxMatchesPerSession?: number
}

export async function buildSearchSessions(
  params: SearchSessionsParams,
): Promise<Record<string, SearchResult[]>> {
  const { query, project, maxMatchesPerSession = 5 } = params
  const { from, to } = { ...defaultDateRange(), ...params }
  const lowerQuery = query.toLowerCase()

  const projectDirs = getProjectDirs()
  const result: Record<string, SearchResult[]> = {}

  const sessionDetailPromises: Array<{
    projectName: string
    promise: Promise<SearchResult | null>
  }> = []

  for (const { name: projectName, dirPath } of projectDirs) {
    if (project && projectName.toLowerCase() !== project.toLowerCase()) continue

    const index = loadSessionsIndex(dirPath)
    if (!index) continue
    const entries = filterEntriesByDateRange(index.entries, from, to)

    for (const entry of entries.filter((e) => !e.isSidechain)) {
      const summary: SessionSummary = {
        sessionId: entry.sessionId,
        project: projectName,
        gitBranch: entry.gitBranch ?? 'unknown',
        startedAt: entry.created,
        endedAt: entry.modified,
        firstPrompt: entry.firstPrompt ?? '',
        messageCount: entry.messageCount,
      }

      const promise = parseDetailFromJsonl(projectName, summary, entry.fullPath).then((detail) => {
        const allMessages: MessageMatch[] = [
          ...detail.userMessages.map((m) => ({ ...m, role: 'user' as const })),
          ...detail.assistantMessages.map((m) => ({ ...m, role: 'assistant' as const })),
        ]

        const allMatches = allMessages.filter((msg) =>
          msg.text.toLowerCase().includes(lowerQuery),
        )
        if (allMatches.length === 0) return null

        const sortedMatches = [...allMatches].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )

        return {
          sessionId: detail.sessionId,
          project: detail.project,
          gitBranch: detail.gitBranch,
          startedAt: detail.startedAt,
          endedAt: detail.endedAt,
          firstPrompt: detail.firstPrompt,
          messageCount: detail.messageCount,
          matches: sortedMatches.slice(0, maxMatchesPerSession),
          matchCount: allMatches.length,
        } satisfies SearchResult
      })
      sessionDetailPromises.push({ projectName, promise })
    }
  }

  const resolved = await Promise.all(
    sessionDetailPromises.map(async ({ projectName, promise }) => ({
      projectName,
      searchResult: await promise,
    })),
  )

  for (const { projectName, searchResult } of resolved) {
    if (!searchResult) continue
    if (!result[projectName]) result[projectName] = []
    result[projectName].push(searchResult)
  }

  return result
}
