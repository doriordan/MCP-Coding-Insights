# Coding Session Reporter

Lightweight MCP server for querying and reporting on your agentic coding sessions across potentially multiple projects and sessions.

Initially this tool supports only Claude Code. 

## What It Does

Claude Code generates transcript files of sessions into `~/.claude/projects/`. While Claude Code uses these transcripts when (for example) resuming sessions or generating its custom report using `/insights` commnd, it does not directly expose the data in these transcripts to general user queries. 

This MCP server exposes tools that can be used with your assistant (which will probably be Claude but may be another tool that supports MCP) for querying these session transcripts, potentilly by project and/or date range.

## Use Cases

This can be used for all sorts of queries and reports, but some example use cases include:

- *Custom Insights* : the built-in `/insights` command gives you lots of useful information which you can help you understand and improve how you use Claude, but you may find custom reports that focus on specific metrics, trends, projects and date ranges even more useful.
- *Standups / Progress Reporting*: you have been working on dozens or even hundreds of features across many sessions and subagents and now need to report on your progress at your daily or weekly standup? Just ask Claude.
- *Traceability*: you have built a new service across multiple sessions and now need to take a step back and review or document how you arrived at design decisions. Querying the transcripts can help.

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


