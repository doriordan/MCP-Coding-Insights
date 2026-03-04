import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { buildListProjects } from './tools/listProjects.js'
import { buildSessionsSummary, SESSION_SUMMARY_FIELDS } from './tools/getSessionsSummary.js'
import { buildSessionLogs, SESSION_DETAIL_FIELDS } from './tools/getSessionLogs.js'
import { buildListSubagents } from './tools/listSubagents.js'
import { buildSubagentDetail } from './tools/getSubagentDetail.js'
import { buildSearchSessions } from './tools/searchSessions.js'

const server = new McpServer({
  name: 'coding-session-reporter',
  version: '0.1.0',
})

server.registerTool(
  'list_projects',
  {
    title: 'List Projects',
    description: 'List all projects that have Claude Code transcript data, with session counts and last active date.',
    inputSchema: {},
  },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(buildListProjects(), null, 2) }],
  })
)

const dateRangeSchema = {
  from: z.string().optional().describe('Start date ISO string, defaults to 7 days ago'),
  to: z.string().optional().describe('End date ISO string, defaults to now'),
  project: z.string().optional().describe('Case-insensitive project name filter'),
}

server.registerTool(
  'get_sessions_summary',
  {
    title: 'Get Sessions Summary',
    description: 'Get a lightweight summary of Claude Code sessions for retrospective narrative reporting. Returns one entry per session with project, branch, start time, first prompt, and message count.',
    inputSchema: {
      ...dateRangeSchema,
      fields: z.array(z.enum(SESSION_SUMMARY_FIELDS)).optional().describe('Fields to include. Omit for all fields. Use to reduce response size (e.g. ["project","startedAt","messageCount"]).'),
    },
  },
  async (params) => ({
    content: [{ type: 'text', text: JSON.stringify(buildSessionsSummary(params), null, 2) }],
  })
)

server.registerTool(
  'get_session_logs',
  {
    title: 'Get Session Logs',
    description: 'Get detailed activity log of Claude Code sessions grouped by project. Includes all user messages and tools used per session. Use for structured activity reports.',
    inputSchema: {
      ...dateRangeSchema,
      sessionId: z.string().optional().describe('Filter to a specific session by ID. Can be combined with from/to to scope messages within that session.'),
      fields: z.array(z.enum(SESSION_DETAIL_FIELDS)).optional().describe('Fields to include in each session. Omit for all fields. Use to reduce response size (e.g. ["project","gitBranch","startedAt","endedAt","firstPrompt","userMessages","toolsUsed"] for standup reports).'),
    },
  },
  async (params) => ({
    content: [{ type: 'text', text: JSON.stringify(await buildSessionLogs(params), null, 2) }],
  })
)

server.registerTool(
  'list_subagents',
  {
    title: 'List Subagents',
    description: 'List all subagents spawned across sessions in a date/project range. Returns agentId, slug, sessionId, firstPrompt, messageCount and toolsUsed per subagent, grouped by project.',
    inputSchema: dateRangeSchema,
  },
  async (params) => ({
    content: [{ type: 'text', text: JSON.stringify(await buildListSubagents(params), null, 2) }],
  })
)

server.registerTool(
  'get_subagent_detail',
  {
    title: 'Get Subagent Detail',
    description: 'Get full details for a specific subagent by agentId. Returns all user messages and tools used. Obtain agentId from list_subagents.',
    inputSchema: {
      agentId: z.string().describe('The agentId of the subagent to retrieve'),
      sessionId: z.string().describe('The sessionId the subagent belongs to'),
      project: z.string().describe('The project name'),
    },
  },
  async (params) => ({
    content: [{ type: 'text', text: JSON.stringify(await buildSubagentDetail(params), null, 2) }],
  })
)

server.registerTool(
  'search_sessions',
  {
    title: 'Search Sessions',
    description: 'Search Claude Code sessions for sessions containing a keyword or phrase in user or assistant messages. Returns matching sessions grouped by project, with the specific matching messages.',
    inputSchema: {
      query: z.string().min(1).describe('Keyword or phrase to search for (case-insensitive)'),
      ...dateRangeSchema,
      maxMatchesPerSession: z.number().int().min(1).optional().describe('Max matching messages to return per session, most recent first. Defaults to 5.'),
    },
  },
  async (params) => ({
    content: [{ type: 'text', text: JSON.stringify(await buildSearchSessions(params), null, 2) }],
  })
)

const transport = new StdioServerTransport()
await server.connect(transport)
