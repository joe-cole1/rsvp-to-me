# Agent Workflow — RSVP to Me (end-to-end runbook)

The complete process from a brand-new conversation through implementation, local CI,
commit, PR, and CI verification. Grounded in `AGENTS.md` (which `CLAUDE.md` requires me
to read and obey before any change). Automated by `scripts/dev-sync.sh`,
`scripts/preflight.sh`, and `scripts/ship.sh`.

---

## 0. Environment (one-time — already configured)

Single WSL-native clone at `~/projects/rsvp-to-me` (ext4). Launch Claude **inside WSL**
with this as the working directory — no Windows→WSL shell bridge.

- **Node 22** via `nvm` (`~/.nvm`). Non-interactive shells load it:
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"`.
- **Docker** (Docker Desktop, WSL integration) for Postgres/Redis.
- **git push/pull** via the Windows Git Credential Manager. Set via CLI (stores the
  backslash-escaped path):
  ```bash
  git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"
  ```
  If you instead hand-edit `~/.gitconfig`, quote the path **without** backslashes:
  ```ini
  [credential]
      helper = "/mnt/c/Program Files/Git/mingw64/bin/git-credential-manager.exe"
  ```
- **`gh`** at `~/.local/bin/gh`, authenticated (`~/.config/gh/hosts.yml`).
- **git identity**: `joe-cole1 <joe.cole1@gmail.com>`.
- **Playwright Chromium** installed and verified to launch (system libs already present;
  only if a test fails on a missing lib: `sudo npx playwright install-deps chromium`).

---

## 1. Start of a NEW conversation

1. **Read `AGENTS.md`** end-to-end (mandated by `CLAUDE.md`). It is the source of truth.
2. **Get the hash** = first 6 chars of the Conversation/Session ID (e.g. `f877ac`).
   Prefixes the branch, every commit, and the PR title.
3. **Sync with remote main** (`git fetch origin`, get onto the latest `main`).
4. **Sync the local environment to the freshly-synced code** — `scripts/dev-sync.sh`:
   `docker compose up -d` → `npm install` → `npm run db:generate` →
   `npx prisma migrate deploy` → `npm run db:seed`. Prevents dep/schema/container drift.
   (`db:seed` is safe to re-run — base rows use `upsert`; the heavy fixtures only load
   when `SEED_TEST_DATA=true` **and** the DB has no events.)
5. **Create ONE feature branch off `origin/main`**, hash-prefixed, matching the single
   release label (`feature|ui/ux|bug|refactor|performance|documentation|tests|chore`):
   `git checkout -b <label>/<hash>-<slug> origin/main`.
   - Local create + push (there is **no GitHub MCP** in this environment).
   - If the one clone is occupied by other uncommitted work, use a **temporary git worktree
     under `~/projects/rsvp-worktrees/`** (e.g. `~/projects/rsvp-worktrees/<hash>`), and
     `git worktree remove` it right after the PR. **Do NOT use `/tmp`** — WSL clears it on
     reboot/cleanup, which corrupts/orphans the worktree metadata.
6. **Go straight to plan** — no builds/tests at startup beyond the sync above.
7. **Approval gate** — present the full plan and **wait for explicit approval** before
   editing any source. Revise and re-present if asked.

---

## 2. Implementation (after plan approval)

- **Reuse before reinventing** — match existing helpers/patterns (`assertHost`,
  `resolveEventAccess`, `@/lib/db` singleton, `lib/rateLimit.ts`, …).
- **Never guess Next 16 / Prisma 7** — read `node_modules/next/dist/docs/` or
  `schema.prisma`. Params are Promises; import Prisma from `@/app/generated/prisma`.
- **Regression test for every bug fix** — `tests/regression/<name>.test.ts` (fails before /
  passes after, header comment), plus a row in `tests/regression/README.md`.
- **Update tests that pin OLD behavior** in the same PR when behavior changes.
- **Log out-of-scope issues** to `ROADMAP.md` (don't fix them here).
- **Mandatory docs BEFORE the PR**: feature/behavior/config/flag/workflow change →
  `docs/admin/`; anything touching self-hosting/ops, guest experience, or UX → also
  `docs/host/`. Pure internal/dev-tooling change with zero behavior/config/UX impact is the
  only exemption — **state that explicitly in the PR**.
- **Roadmap sync** — check off / move any `ROADMAP.md` item addressed.

---

## 3. Local CI — the pre-push gate (run the FULL sequence locally first)

`scripts/preflight.sh` mirrors `.github/workflows/ci.yml` exactly, using **ephemeral**
Postgres/Redis on **non-default ports** so it never touches or corrupts your dev DB and
never clashes with dev services on `5432`/`6379`:

```
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55432/rsvp_test"
REDIS_URL="redis://127.0.0.1:56399"
```

```
scripts/preflight.sh          # full sequence, including Playwright E2E
scripts/preflight.sh --fast   # everything except E2E
```

Strict sequence (aborts on the first failure):

1. **Format** — `npx prettier --check .` (whole repo; every touched `.ts/.md/.yml`/etc.).
2. **Lint** — `npm run lint` (ESLint).
3. **Prisma** — `npm run db:generate` + `npx prisma migrate deploy` (ephemeral test DB).
4. **Unit tests** — `npm test`.
5. **Integration tests** — `npm run test:integration`.
6. **Component tests** — `npm run test:components`.
7. **Build** — `npm run build` (`next build`; generates route types).
8. **Type-check** — `npx tsc --noEmit` (after build so Next's `PageProps` types resolve;
   also checks test files that `next build` skips).
9. **E2E** — **seed** the ephemeral DB (`SEED_TEST_DATA=true npm run db:seed`) for
   deterministic state, start the server **on port 3001** (`PORT=3001`, so it never clashes
   with a dev server on 3000), `npx wait-on` health, then `npm run test:e2e`.

`npm audit --audit-level=high` also runs (CI parity).

---

## 4. Self-review before committing

Enforced as guardrails in `scripts/ship.sh` (and my own manual pass) after staging, before
the commit is created:

- **No secrets/config staged** — never stage a `.env` / `.env.*` file. _(hard block)_
- **No `.only(` in tests** — it silences the rest of the suite in CI. _(hard block)_
  `.skip(` / `it.todo()` are **allowed** — sometimes a deliberately-parked test for a known
  bug or future work; keep it documented (a comment or ROADMAP entry).
- **No debug artifacts** — no stray `console.log` / `console.debug` / `debugger` in staged
  **app** source (`app/`, `components/`, `lib/`). _(hard block; scripts/prisma/tests exempt)_
- **No dead code / temp files** — no unused imports (ESLint catches these), orphaned mocks,
  or scratch files. Review `git diff --cached`; only the intended files staged.

---

## 5. Commit + push + open the PR

`scripts/ship.sh` runs preflight, runs the self-review guardrails, then (only if green)
commits (husky hook runs natively — no `--no-verify`), pushes (GCM), and opens the PR
(`gh pr create --fill --label <label>`):

```
scripts/ship.sh "[<hash>] <type>(<scope>): <summary>" --label <label>         # full CI + E2E
scripts/ship.sh "[<hash>] <type>(<scope>): <summary>" --label <label> --fast  # skip E2E
```

- The user's instruction **"commit and PR"** is the confirmation to commit/push.
- `[<hash>]` prefixes the commit AND the PR title; exactly ONE release label per PR.
- `--no-verify` **only** for non-substantive changes (only `AGENTS.md`, `ROADMAP.md`, or
  `docs/**` markdown). Any functional code change commits **with** hooks.
- **Check for an existing open PR** on the branch first (`gh pr list --head <branch>`).
- Remove any temporary `~/projects/rsvp-worktrees/` worktree afterward.

---

## 6. Check CI on the PR

```
gh pr checks <pr-number> --watch       # live status of lint-and-build + e2e jobs
gh run view <run-id> --log-failed      # logs if something failed
```

Preflight mirrors CI, so this should be green — but confirm. On failure: diagnose from the
logs, fix, re-run `preflight.sh` locally to reproduce, push the fix, repeat until green.

---

## 7. Housekeeping

- **Restart the local dev server** after commit/push so `localhost:3000` reflects the latest.
  `fuser` is not on every WSL distro — use the more universal `lsof`:
  ```bash
  kill -9 $(lsof -t -i:3000) 2>/dev/null || true
  npm run dev   # (run as a background task)
  ```
- **Re-sync every other open branch** after any PR merges (fetch `main`, merge, resolve;
  `ROADMAP.md` and `tests/regression/README.md` are guaranteed collision points — keep BOTH
  sides' entries; prettier-check; push).
- **Respect GitHub-UI conflict resolutions** (fetch and adopt rather than force-push over).

---

## Happy path

```
new convo → read AGENTS.md → get hash → git fetch → scripts/dev-sync.sh
          → branch off origin/main → research → PLAN → (await approval)
          → implement + tests + docs + ROADMAP
          → self-review (no .env / .only / console.log / dead code)
          → scripts/preflight.sh                       (full local CI green)
          → scripts/ship.sh "[hash] …" --label X       (commit+push+PR, hooks run)
          → gh pr checks <n> --watch                   (confirm CI green)
          → restart dev server; on merge, re-sync open branches
```
