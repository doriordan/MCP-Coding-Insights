# MCP Coding Insights

Lightweight MCP server for obtaining insights into your agentic coding sessions across potentially multiple projects and sessions.

Initially this tool supports only Claude Code.

## What It Does

Claude Code generates transcript files of sessions into `~/.claude/projects/`. While Claude Code uses these transcripts when (for example) resuming sessions or generating its custom report using `/insights` commnd, it does not directly expose the data in these transcripts to general user queries.

This MCP server exposes tools that can be used with your assistant (which will probably be Claude but may be another tool that supports MCP) for querying these session transcripts, potentilly by project and/or date range.

## Use Cases

This can be used for all sorts of queries and reports, but some example use cases include:

- _Custom Insights_ : the built-in `/insights` command gives you lots of useful information which can help you understand and improve how you use Claude, but you may find custom reports that focus on insights, trends, projects and date ranges of specific interest to be even more useful.
- _Standups / Progress Reporting_: you have been working on dozens or even hundreds of features across many sessions and subagents and now need to report on your progress at your daily or weekly standup? Just ask Claude.
- _Traceability_: you have built a new service across multiple sessions and now need to take a step back and review or document how you arrived at design decisions. Querying the transcripts can help.

## Quickstart

By its nature this server is intended to be installed and used locally on the developer laptop or workstation, alongside Claude Code.

### Setup

For the following configuration, you should have `node`, `npm` and Claude Code installed (other setups are possible).

Clone this repository, install dependencies, then configure it for use with Claude Code as follows (this adds it globally for all your projects):

```bash
cd <path-to-repo> && npm install
claude mcp add coding-session-reporter --scope user -- <path-to-repo>/node_modules/.bin/tsx <path-to-repo>/src/index.ts
```

You will then (after granting permissions for this server when prompted) be able to ask Claude various questions about your Claude sessions, as in the following examples.

## Example Prompts

`summarise key pain points encountered coding this project`

`summarise coding activity yesterday by project in standup presentation appropriate format`

`for the project 'my_project' rank the busiest days over the last month`

`provide a high level summary of subagent usage across all projects yesterday`

`show me all messages in the last month that reference typescript, broken down by project`

## Tools

- **`list_projects`** — List all projects that have Claude Code transcript data, with session counts and last active date
- **`get_sessions_summary`** — Get a high level summary of sessions (optionally for specific project and/or date range)
- **`get_session_logs`** — full session detail grouped by project (optionally for a specific project, session ID and/or date/range)
- **`list_subagents`** - list all subagents grouped by project (optionally for a specific project and/or date range)
- **`get_subagent_detail`** - get full details (user messages, tools used) for a specific subagent
- **`search_sessions`** - search for a specific keyword (optionally for a specific project and/or date range), returning all matching user/assistant messages up to some configurable per session maximum count.

## Performance And Context Usage

For most _"normal"_ sessions and queries, this MCP server provides quick results with modest additional context usage implications. In the absence of this MCP server, Claude would probably try to answer questions like the above by using bash tools to directly access and parse the session transcripts. In most cases this leads to more complex and slower processing, higher context usage and more error prone results, so this server remains the best choice for typical cases.

But still, in some cases this server may gather a very large result set which has implications both for the performance of the service itself and perhaps more importantly the context window. Queries/reports that may result in very large result sets generally involve one or more of the following:

- especially heavy coding sessions
- large number of projects
- wide date range (the default is 1 week which is normally ok)
- queries that require detailed logs (content of messages, tool calls etc) to be returned

The folllowing are a few tips for handling these scenarios:

_Tip #1_: Try constraining the query to the specific project(s), date range and/or data needed.

_Tip #2_: The easiest and probably best general strategy is to enable this server and let Claude handle automatically falling back to the direct approach if the reporting tool call fails (most likely due to the tool results exceeding context limits).

_Tip #3_: Use distinct sessions for your reporting that are separate to those you use for your coding activities - this ensures the context usage for reporting doesn't affect your coding sessions and vice versa.
