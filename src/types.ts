// Model representing the information in Claude Code session transcripts

export interface ProjectInfo {
  name: string           // human-readable decoded name e.g. "code-"
  path: string           // full path to project directory
  sessionCount: number
  lastActive: string     // ISO timestamp
}

export interface SessionSummary {
  sessionId: string
  project: string
  gitBranch: string
  startedAt: string
  firstPrompt: string
  messageCount: number
}

export interface SubagentSummary {
  agentId: string
  slug: string
  sessionId: string
  firstPrompt: string
  messageCount: number
  toolsUsed: string[]
}

export interface SubagentDetail extends SubagentSummary {
  startedAt: string
  endedAt: string
  userMessages: string[]
}

export interface UserMessage {
  text: string
  timestamp: string
}

export interface ToolUse {
  name: string
  timestamp: string
}

export interface SessionDetail extends SessionSummary {
  endedAt: string
  userMessages: UserMessage[]
  assistantMessages: UserMessage[]
  toolsUsed: ToolUse[]
  subagents?: SubagentSummary[]
}

export interface MessageMatch {
  text: string
  timestamp: string
  role: 'user' | 'assistant'
}

export interface SearchResult {
  sessionId: string
  project: string
  gitBranch?: string
  startedAt: string
  endedAt?: string
  firstPrompt: string
  messageCount: number
  matches: MessageMatch[]
  matchCount: number
}

// Shape of a sessions-index.json entry
export interface IndexEntry {
  sessionId: string
  fullPath: string
  firstPrompt: string
  summary: string
  messageCount: number
  created: string
  modified: string
  gitBranch: string
  projectPath: string
  isSidechain: boolean
}

export interface SessionsIndex {
  version: number
  entries: IndexEntry[]
}
