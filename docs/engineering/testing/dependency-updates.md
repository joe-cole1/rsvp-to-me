# Dependency and test compatibility

This policy applies to every dependency and every test in RSVP to Me. Compatible
updates should pass without updating a second copy of the selected version or
freezing incidental output from a library. Changes to observable behavior,
supported runtime requirements, security guarantees and coverage remain
reviewable, blocking failures.

## Sources of truth

- `package.json` declares allowed dependencies and engine ranges; `npm ci`
  validates and installs the exact tree in `package-lock.json`.
- `worker/package.json` and its lockfile describe an independent toolchain.
  Security requirements apply there too, without requiring its native tools to
  have the same versions as the application.
- `.nvmrc` selects local and CI Node. Docker's base image retains an exact
  version and digest, checked against the supported runtime rather than a copy
  of the Node/Alpine patch in a test.
- `scripts/playwright-image.cjs` derives the Docker image from the installed
  Playwright package. Both Docker entry points use it. A newer package requires
  no manual image-pin edit; browser launch and application E2E checks still run.
- GitHub Actions remain pinned to reviewed commit SHAs. Updating a workflow
  action must satisfy its functional checks; tests do not repeat its selected SHA.

## Rules for tests

1. Assert effects through public APIs, parsed documents, accessibility roles,
   application state and real integration behavior. Attribute order, color
   spacing, equivalent CSS ratios, generated names and build-log wording are
   incidental unless the application explicitly promises them.
2. Security versions identify a documented patched minimum or affected range.
   Check every matching root and nested lockfile resolution. Allow a transitive
   package to disappear when upstream removes it. Still require direct packages
   used by the application, and reject missing versions on present entries.
3. Package synchronization checks describe packages actually used together:
   React/React DOM, Prisma CLI/client/adapter, Vitest/coverage, and the selected
   Next.js toolchain. Compare their resolved versions. `npm ci` handles manifest
   ranges and lockfile consistency; equal range strings are not required.
4. Use the selected tool's declared entry points and repository-owned test
   stubs. Vitest uses a local empty `server-only` marker instead of a private
   Next.js distribution path. Prisma config validation and the font fixture
   invoke the installed public CLIs. Stale-client UI fixtures stub Next's public
   error classifier, avoiding a private constructor and message-based guessing.
   Production boundary enforcement and the real browser integration are unchanged.
5. A modified dependency guard needs fixtures for valid future releases and
   invalid/below-floor versions. Keep tests that demonstrate actual behavior,
   production dependency audits and existing coverage thresholds enabled.
6. Do not replace expected values with whatever the new dependency returns,
   skip tests on dependency PRs, hide failures with retries, or regenerate
   snapshots without reviewing the behavior they represent.

## November 2026 audit

The audit started from `f2db1e2` and covered both package manifests, both
lockfiles, all 230 existing test/spec files, test helpers/configuration, scripts, Docker
configuration and GitHub workflows. There were 55 unique direct application
dependencies and 2 worker dependencies. The inventory below covers every direct
dependency at that baseline; the rules above also cover additions and transitive
dependencies.

| Area                                | Direct dependencies reviewed                                                                                                         | Behavior and verification                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework and runtime               | `next`, `react`, `react-dom`, `tsx`, `dotenv`                                                                                        | Builds, server boundaries, routes, seeding and environment setup; CI Node comes from `.nvmrc`.                                                         |
| Database and scheduling             | `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `redis`, `node-cron`                                                         | Real adapter transactions, migrations, locks, rate limiting, scheduling and application access checks.                                                 |
| Authentication and validation       | `bcryptjs`, `iron-session`, `zod`                                                                                                    | Session/token behavior, authorization, input bounds and stable machine-readable error fields.                                                          |
| UI and styling                      | `@radix-ui/themes`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss`, `@tailwindcss/postcss`      | Component semantics, interactions, class merging, styles and the production CSS build. Fixed product dimensions remain asserted.                       |
| Internationalization and docs       | `next-intl`, `@formatjs/icu-messageformat-parser`, `react-markdown`, `remark-gfm`, `rehype-slug`, `rehype-highlight`, `highlight.js` | Catalog integrity, canonical anchors, safe Markdown, locale/direction and navigation. DOM assertions avoid serialized attribute-order assumptions.     |
| Email and media                     | `nodemailer`, `html-to-text`, `react-email`, `@react-email/ui`, `sharp`, `qrcode`                                                    | SMTP delivery, rendered HTML/plain text, token links, contrast, escaping, image transforms and QR exports. Independent Sharp resolutions must be safe. |
| Test runners and browser simulation | `vitest`, `@vitest/coverage-v8`, `jsdom`, `@playwright/test`                                                                         | Complete suites, coverage and browser flows; installed Playwright selects its environment automatically and CSS ratio assertions tolerate rounding.    |
| Test helpers and generated cases    | `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `fast-check`, `wait-on`                        | Accessible controls, event behavior, generated inputs and server readiness; test semantics remain stable across helper releases.                       |
| Type declarations and compiler      | `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/pg`, `@types/qrcode`, `@types/html-to-text`                 | Strict application/test/worker type checks. Node declaration major follows the supported runtime.                                                      |
| Development automation              | `eslint`, `eslint-config-next`, `prettier`, `husky`, `lint-staged`                                                                   | Lint, formatting and hooks. The brace-expansion check exercises behavior through either minimatch export shape.                                        |
| Worker                              | `wrangler`, `@cloudflare/workers-types`                                                                                              | Independent clean install, security floors, dry-run bundle and standalone type check; Dependabot covers this manifest too.                             |

Removed administrative blockers included the esbuild override's exact release,
the repeated Node/Alpine image patch, identical manifest-range strings, required
presence of retired transitive packages, cross-project Sharp equality, the
Playwright image pin, CSS/HTML serialization assumptions and build-log text.
Preflight now always performs a clean install so an old `node_modules` directory
cannot masquerade as validation of a changed lockfile. Duplicate manifest keys
were removed without changing any selected dependency or lockfile.

Generated font/build fixtures under `.vitest/` and agent worktrees under
`.claude/` are excluded from lint, app type checking and unit discovery. The
discovery regression exercises ESLint and TypeScript's real public APIs and
confirms application sources remain included, preventing temporary dependency
test artifacts from becoming unrelated check failures.

No stored snapshots or screenshot baselines were present. Existing SQL migration
fixtures, machine-readable Prisma/Zod error codes, product text, asset paths,
security-sensitive escaping checks and explicit product dimensions express
application contracts and remain covered.

## Validation for changes

Run focused regression tests, the complete unit suite with coverage, component
tests, integration tests, lint, formatting and type checks. Dependency/tooling
changes require the repository preflight; Playwright and DOM simulation changes
also require the browser suite. Production container checks continue on both
AMD64 and ARM64. Record failures and unavailable infrastructure explicitly.

For representative update testing, install a candidate package into the local
test tree without saving manifest or lockfile changes, run the relevant suites,
then restore the selected tree with `npm ci`. Test new versions on their own
merits; fixtures demonstrating generic forward compatibility do not establish
that every future major release is compatible.

## Changed files

The implementation updates these files:

- `.github/dependabot.yml`
- `.github/workflows/ci.yml`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `WORKFLOW.md`
- `docs/admin/local-development.md`
- `docs/engineering/testing/dependency-updates.md`
- `eslint.config.mjs`
- `package.json`
- `scripts/README.md`
- `scripts/check-playwright-docker.sh`
- `scripts/playwright-image.cjs`
- `scripts/preflight.sh`
- `scripts/run-e2e-docker.sh`
- `tests/components/EventHero.test.tsx`
- `tests/components/FrontendPrimitives.test.tsx`
- `tests/components/HostBarLocale.test.tsx`
- `tests/components/InlineEdit.test.tsx`
- `tests/helpers/css.ts`
- `tests/helpers/dependency-versions.ts`
- `tests/helpers/server-only.ts`
- `tests/lib/docs-localization.test.tsx`
- `tests/regression/README.md`
- `tests/regression/dependency-security-baseline.test.ts`
- `tests/regression/dependency-update-contracts.test.ts`
- `tests/regression/docker-runtime-hardening.test.ts`
- `tests/regression/generated-test-workspaces.test.ts`
- `tests/regression/ghsa-f88m-g3jw-g9cj-sharp-libvips.test.ts`
- `tests/regression/ghsa-g7r4-m6w7-qqqr-esbuild-traversal.test.ts`
- `tests/regression/ghsa-mh99-v99m-4gvg-brace-expansion.test.ts`
- `tests/regression/notification-stale-client.test.tsx`
- `tests/regression/npm-deprecation-warnings.test.ts`
- `tests/regression/playwright-docker-parity.test.ts`
- `tests/regression/roboto-font-build.test.ts`
- `tests/regression/vitest-excludes-agent-worktrees.test.ts`
- `tsconfig.json`
- `vitest.components.config.ts`
- `vitest.config.ts`
- `vitest.integration.config.ts`

## Validation results for this change

- Node 22.23.1 and npm 10.9.8.
- Locked dependency tree: 1,993 unit tests across 179 files and 229 component
  tests across 28 files passed.
- Coverage: 87.11% statements, 81.19% branches, 87.71% functions and 88.61%
  lines; all existing thresholds passed.
- A temporary candidate tree containing jsdom 31.0.0 and Playwright 1.65.0
  passed the full 1,990-test unit suite and 229 component tests before the final
  discovery guards were added. Those guards passed their four focused tests
  against the candidate tree too. Playwright discovered all 53 E2E cases.
- The production build, application/test and worker type checks, worker dry-run
  bundle, formatting, shell/JavaScript syntax and YAML parsing passed. Lint has
  zero errors and three existing warnings in unchanged UI files.
- Application and worker production dependency audits reported zero vulnerabilities.
- Full preflight was attempted and stopped before services start because Docker
  is unavailable. PostgreSQL/Redis integration, full application browser flows
  and production container checks remain to run in a Docker-capable environment
  or GitHub CI. Test discovery is not a substitute for executing those flows.

The locked tree was restored with `npm ci`; selected dependencies and both
lockfiles are unchanged. On 2026-11-10, the user approved shipping with the
local Docker preflight waived because Docker is unavailable in this environment.
The remaining integration, executed browser and container checks must run in
GitHub CI; no CI checks or coverage thresholds are disabled.
