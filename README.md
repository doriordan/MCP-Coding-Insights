# MCP Coding Insights

Lightweight MCP server combined with a starting skill that lets you flexibly report insights into your coding activities by just asking your agent. This is useful for all sorts of use cases, from strategic insights to help improve how you use the coding agent to quick activity summaries for daily standups.

Initially this tool supports only Claude Code.

## Overview

Claude Code supports an `/insights` command that generates a very specific report on your coding activity for a fixed time span.

This MCP server expands that capability by exposing tools that the agent can use to serve reports tailored to your stated requirements as opposed to a predefined format, and if you want can be scoped to specific projects and time spans. This signicantly widens the potential use cases and allows great flexibility in both the content and presentation of reports.

The tools access the same session transcript files under `~/.claude/projects/`as the `/insights` command, but give you the power to make ad-hoc reporting requests on that session information.

### Skills

This repository also includes a HTML Coding Reporter skill that helps Claude to generate self-contained HTML reports into your coding activities. The skill is used to generate an appropriate report based on the expressed user intent, using the MCP server to retrieve relavant session details.

Use of this skill is entirely optional -  without this skill Claude will generally output the report in text format straight to the terminal. 

Feel free to extend or customise the skill according to your use cases and preferences.

### Examples

The following are just a few examples of prompts that demonstrate useful reporting with this MCP server:

`generate a weekly summary report including key activities and high level breakdown of time spent on each project`

`summarise key pain points encountered coding this project`

`summarise coding activity yesterday by project in standup presentation appropriate format`

`for the current project rank the busiest days over the last month`

`provide a high level summary of subagent usage across all projects yesterday`

`show me all messages in the last month that reference typescript, broken down by project`

# Quickstart

By its nature this server is intended to be installed and used locally on the developer laptop or workstation, alongside Claude Code.

### MCP Server Setup

For the following configuration, you should have `node`, `npm` and Claude Code installed (other setups are possible).

Clone this repository and then install dependencies and configure it for use with Claude Code as follows (this adds it globally for all your projects):

```bash
cd <path-to-repo> && npm install
claude mcp add mcp-coding-insights --scope user -- `pwd`/node_modules/.bin/tsx `pwd`/src/index.ts
```

You will then (after granting permissions for this server when prompted) be able to ask Claude various questions about your Claude sessions - you could start by trying some of the example prompts above.

### Skills Setup

To enable the HTML Coding Reporter skill, copy it from [here](./skills/html-reporter/SKILL.md) into your skills (e.g. under `~/.claude/skills/html-coding-reporter/`), restart Claude. Now you can generate HTML reports tailored to your intention - for example, try the following in Claude:

```claude
generate a weekly summary report including key activities and high level breakdown of time spent on each project
```

Claude will generate a HTML report into a temporary directory and open it up in browser.

# Tools

- **`list_projects`** — List all projects that have Claude Code transcript data, with session counts and last active date
- **`get_sessions_summary`** — Get a high level summary of sessions (optionally for specific project and/or date range)
- **`get_session_logs`** — full session detail grouped by project (optionally for a specific project, session ID and/or date/range)
- **`list_subagents`** - list all subagents grouped by project (optionally for a specific project and/or date range)
- **`get_subagent_detail`** - get full details (user messages, tools used) for a specific subagent
- **`search_sessions`** - search for a specific keyword (optionally for a specific project and/or date range), returning all matching user/assistant messages up to some configurable per session maximum count.

# Performance And Context Usage

For most _"normal"_ sessions and queries, this MCP server provides quick results with modest additional context usage implications. In the absence of this MCP server, Claude would probably try to answer questions like the above by using bash tools to directly access and parse the session transcripts. In most cases this leads to more complex and slower processing, higher context usage and more error prone results, so this server remains the best choice for typical cases.

But still, in some cases this server may gather a very large result set which has implications both for the performance of the service itself and perhaps more importantly the context window. Queries/reports that may result in very large result sets generally involve one or more of the following:

- especially heavy coding sessions
- large number of projects
- wide date range (the default is 1 week which is normally ok)
- queries that require detailed logs (content of messages, tool calls etc) to be returned

The folllowing are a few tips for handling these scenarios:

_Tip #1_: Try constraining the query to the specific project(s), date range and/or data needed.

_Tip #2_: The easiest and probably best general strategy is to enable this server and let Claude handle automatically falling back to the direct approach if the reporting tool call fails (most likely due to the tool results exceeding context limits).

_Tip #3_: Use distinct sessions for your reporting that are separate to those you use for your coding activities - this ensures the context usage for reporting doesn't affect your coding sessions and vice versa. You can even use an agent other than Claude for this reporting, as long as the agent supports local MCP services.

_Tip #4_: Use skills to capture context management rules relevant for your use case for Claude. For example, the included HTML Coding Reporter skill has explicit step-by-step instructions to minimise context usage, in this case by loading messages one session at a time when summarising by session - it discards the messages for that session (retaining only the summary) before proceeding to the next session.
