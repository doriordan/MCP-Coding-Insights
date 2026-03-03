import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSearchSessions } from '../src/tools/searchSessions.js'
import * as transcripts from '../src/transcripts.js'

vi.mock('../src/transcripts.js')

const mockProjectDirs = [
  { name: 'my-project', dirPath: '/projects/my-project' },
  { name: 'other-project', dirPath: '/projects/other-project' },
]

const mockIndex = {
  version: 1 as const,
  entries: [
    {
      sessionId: 'sess-1',
      fullPath: '/projects/my-project/sess-1.jsonl',
      firstPrompt: 'fix the login bug',
      summary: '',
      messageCount: 3,
      created: '2026-03-01T10:00:00Z',
      modified: '2026-03-01T10:30:00Z',
      gitBranch: 'main',
      projectPath: '/home/user/my-project',
      isSidechain: false,
    },
    {
      sessionId: 'sess-2',
      fullPath: '/projects/my-project/sess-2.jsonl',
      firstPrompt: 'add dark mode',
      summary: '',
      messageCount: 2,
      created: '2026-03-02T09:00:00Z',
      modified: '2026-03-02T09:30:00Z',
      gitBranch: 'feature/dark-mode',
      projectPath: '/home/user/my-project',
      isSidechain: false,
    },
  ],
}

const mockDetail1 = {
  sessionId: 'sess-1',
  project: 'my-project',
  gitBranch: 'main',
  startedAt: '2026-03-01T10:00:00Z',
  endedAt: '2026-03-01T10:30:00Z',
  firstPrompt: 'fix the login bug',
  messageCount: 3,
  userMessages: [
    { text: 'fix the login bug', timestamp: '2026-03-01T10:00:00Z' },
    { text: 'the error happens in auth.ts', timestamp: '2026-03-01T10:10:00Z' },
    { text: 'looks good now', timestamp: '2026-03-01T10:20:00Z' },
  ],
  toolsUsed: [],
}

const mockDetail2 = {
  sessionId: 'sess-2',
  project: 'my-project',
  gitBranch: 'feature/dark-mode',
  startedAt: '2026-03-02T09:00:00Z',
  endedAt: '2026-03-02T09:30:00Z',
  firstPrompt: 'add dark mode',
  messageCount: 2,
  userMessages: [
    { text: 'add dark mode', timestamp: '2026-03-02T09:00:00Z' },
    { text: 'use CSS variables', timestamp: '2026-03-02T09:10:00Z' },
  ],
  toolsUsed: [],
}

describe('buildSearchSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(transcripts.getProjectDirs).mockReturnValue(mockProjectDirs)
    vi.mocked(transcripts.loadSessionsIndex).mockReturnValue(mockIndex)
    vi.mocked(transcripts.filterEntriesByDateRange).mockImplementation(
      (entries) => entries,
    )
    vi.mocked(transcripts.parseDetailFromJsonl).mockImplementation(
      async (_project, summary) => {
        if (summary.sessionId === 'sess-1') return mockDetail1
        return mockDetail2
      },
    )
  })

  it('returns sessions where user messages contain the query (case-insensitive)', async () => {
    const result = await buildSearchSessions({ query: 'bug' })

    expect(result).toMatchObject({
      'my-project': [
        {
          sessionId: 'sess-1',
          matchCount: 1,
          matches: [{ text: 'fix the login bug' }],
        },
      ],
    })
    expect(result['my-project']).toHaveLength(1)
  })

  it('matches case-insensitively', async () => {
    const result = await buildSearchSessions({ query: 'ERROR' })

    expect(result['my-project'][0].matches).toHaveLength(1)
    expect(result['my-project'][0].matches[0].text).toBe(
      'the error happens in auth.ts',
    )
  })

  it('returns empty object when no sessions match', async () => {
    const result = await buildSearchSessions({ query: 'typescript' })
    expect(result).toEqual({})
  })

  it('returns multiple matches within one session', async () => {
    const result = await buildSearchSessions({ query: 'the' })

    const sess1 = result['my-project'].find((r) => r.sessionId === 'sess-1')
    expect(sess1?.matchCount).toBe(2) // "fix the login bug" and "the error happens"
  })

  it('sorts matches descending by timestamp (most recent first)', async () => {
    const result = await buildSearchSessions({ query: 'the' })

    const sess1 = result['my-project'].find((r) => r.sessionId === 'sess-1')!
    // "the error happens in auth.ts" at 10:10 comes before "fix the login bug" at 10:00
    expect(sess1.matches[0].timestamp).toBe('2026-03-01T10:10:00Z')
    expect(sess1.matches[1].timestamp).toBe('2026-03-01T10:00:00Z')
  })

  it('caps matches per session to maxMatchesPerSession, keeping most recent', async () => {
    const result = await buildSearchSessions({ query: 'the', maxMatchesPerSession: 1 })

    const sess1 = result['my-project'].find((r) => r.sessionId === 'sess-1')!
    expect(sess1.matches).toHaveLength(1)
    expect(sess1.matches[0].timestamp).toBe('2026-03-01T10:10:00Z') // most recent kept
    expect(sess1.matchCount).toBe(2) // total found, not capped
  })

  it('defaults maxMatchesPerSession to 5', async () => {
    // sess-1 has only 2 matches for "the", both should be returned with default cap
    const result = await buildSearchSessions({ query: 'the' })

    const sess1 = result['my-project'].find((r) => r.sessionId === 'sess-1')!
    expect(sess1.matches).toHaveLength(2)
  })

  it('filters by project name (case-insensitive)', async () => {
    vi.mocked(transcripts.getProjectDirs).mockReturnValue([
      { name: 'my-project', dirPath: '/projects/my-project' },
      { name: 'other-project', dirPath: '/projects/other-project' },
    ])
    vi.mocked(transcripts.loadSessionsIndex).mockReturnValue({
      version: 1,
      entries: [],
    })

    const result = await buildSearchSessions({
      query: 'bug',
      project: 'OTHER-PROJECT',
    })

    expect(result).toEqual({})
    // loadSessionsIndex called only for other-project
    const calls = vi.mocked(transcripts.loadSessionsIndex).mock.calls
    expect(calls.every(([path]) => path.includes('other-project'))).toBe(true)
  })

  it('includes full session metadata in results', async () => {
    const result = await buildSearchSessions({ query: 'bug' })
    const session = result['my-project'][0]

    expect(session).toMatchObject({
      sessionId: 'sess-1',
      project: 'my-project',
      gitBranch: 'main',
      startedAt: '2026-03-01T10:00:00Z',
      firstPrompt: 'fix the login bug',
      messageCount: 3,
    })
  })
})
