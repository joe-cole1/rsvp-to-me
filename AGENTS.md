<!-- BEGIN:git-mcp-rules -->
# Git, Commits, and Pull Requests — User Execution Only

**Do not attempt to commit, push, or open pull requests to GitHub directly (neither via CLI nor via MCP tools).**

Instead, follow this workflow:
1. When changes are complete, verified, and ready, show the exact PowerShell git commands for the USER to run on their system (e.g., `git add`, `git commit -m "..."`, and `git push origin <branch>`).
2. Verify that the local diff matches the changes we want to push before handing off.
3. Only use GitHub MCP tools for read-only operations (like listing commits, branches, or checking remote file contents) if necessary.

**Rationale:** This saves token overhead, avoids sandbox credential/TTY hang issues, and ensures the user maintains complete control over remote commits.
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

<!-- BEGIN:pre-modification-rules -->
# Pre-Modification Rules

**CRITICAL RULE:** Always force a `git fetch` and `git pull` (or use GitHub MCP tools as appropriate to sync) to ensure you have the latest remote code *before* you touch, edit, or modify any files. Do this at the start of a chat session, when resuming work, or anytime the user indicates they made manual changes.
<!-- END:pre-modification-rules -->
