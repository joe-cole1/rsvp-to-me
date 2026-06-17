<!-- BEGIN:git-mcp-rules -->
# Git, Commits, and Pull Requests — MCP Only

**For all Git, commit, and PR operations, you are strictly required to use the GitHub MCP tools rather than local terminal commands.**

This means:
- **Never** run `git push`, `git commit`, `git add`, `git pull`, `gh pr create`, or any other `git`/`gh` CLI command to interact with the remote.
- **Always** use the `github-mcp-server` MCP tools for remote operations:
  - `push_files` — commit and push one or more files to a branch
  - `create_pull_request` — open a PR
  - `update_pull_request` — edit a PR title/body/state
  - `merge_pull_request` — merge a PR
  - `get_file_contents` — read a file from a specific branch or commit
  - `list_commits`, `list_branches`, `list_pull_requests` — inspect repo state
- Local `git` commands (e.g. `git status`, `git log`, `git show`) are acceptable **read-only** for inspecting the local workspace, but must never be used to write to or communicate with the remote.

**Rationale:** The sandbox environment cannot open interactive credential prompts (Windows Credential Manager / `/dev/tty`), so any `git push` will hang indefinitely. The MCP tools use the GitHub API and token-based auth that works without a TTY.
<!-- END:git-mcp-rules -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
