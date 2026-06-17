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

<!-- BEGIN:session-setup-rules -->
# Handoff and Session Startup Rules

At the start of every new chat session or when resuming work:
1. **Sync with Remote Main**:
   - First, run `git fetch origin` to check for any remote changes.
   - Run `git merge origin/main` (or pull/rebase appropriately) to ensure the local branch contains the absolute latest version of the code. If there are local changes, stash them first (`git stash`), sync, and then apply them back (`git stash pop`).
2. **Wipe and Rebuild Local Docker Environment**:
   - Run `docker compose down` to shut down and clean up active containers and networks.
   - Delete the local dev database file `data/prod.db` to ensure a completely fresh data state (clearing stale DB records and seeding fresh).
   - Run `docker compose up --build -d` to compile the application and launch the containers from scratch, ensuring no cached database state, assets, or CSS remain.
<!-- END:session-setup-rules -->
