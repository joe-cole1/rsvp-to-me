# Contributing to RSVP to Me

Bug reports, documentation improvements, translations, tests, and code contributions
are welcome. Keep changes focused on the problem you are solving.

## Before you start

Search existing issues and pull requests before opening a new one. Small fixes,
documentation corrections, and translation improvements can come straight as a
pull request. For a substantial feature, dependency change, or architectural
change, open an issue to agree on scope before investing in an implementation.
An issue being open does not mean an implementation has been accepted.

## Issues and questions

Use the [issue chooser](https://github.com/joe-cole1/rsvp-to-me/issues/new/choose):

- **Bug report:** Describe what happened, what you expected, and how to reproduce
  it. Include the release tag, image digest, or commit if you know it, plus the
  relevant browser and deployment details.
- **Feature request:** Explain the user problem and the outcome you want. Mention
  existing features or workarounds you tried so we can consider the smallest
  useful change.
- **Question or help:** Ask about usage, installation, development, or licensing.
  Explain what you have already checked.

Blank issues remain available for reports that do not fit a form. See the
[host guides](docs/host/) and [admin guides](docs/admin/) for existing documentation.

## Security reports and private information

Do not publish vulnerability details in a public issue. Use GitHub's private
vulnerability reporting from the repository's **Security** tab if that option is
available. Otherwise, ask the maintainer for a private reporting channel without
including exploit details or affected users' information.

Before sharing logs, screenshots, or reproduction data, remove `.env` values,
passwords, API keys, cookies, magic sign-in links, RSVP edit tokens, private event
links, guest contact information, and private uploads. A sanitized example event
is usually sufficient to demonstrate a problem.

## Development setup

Fork the repository and create a branch from the latest upstream `main`. Open
your pull request against `joe-cole1/rsvp-to-me:main`.

Follow the [local development guide](docs/admin/local-development.md) for
prerequisites and local `.env` configuration. On Windows, run Git, Node, npm,
Prisma, and Docker commands inside WSL and keep the checkout on the Linux
filesystem. Use the Node version in `.nvmrc` and the npm version supported by
`package.json`.

From the repository root, install the selected Node version and synchronize a
fresh checkout:

```bash
nvm install
nvm use
scripts/dev-sync.sh --deps
```

Start the development server separately:

```bash
npm run dev
```

The app runs at `http://localhost:3000`; Docker provides the local PostgreSQL and
Redis services. The sync script applies migrations and seeds baseline data, so
use a disposable local database. After switching branches, run
`scripts/dev-sync.sh`; use `--deps` when the package manifests changed.

## Making changes

- Consult [ARCHITECTURE.md](ARCHITECTURE.md) to find the existing subsystem before
  adding a new abstraction. Follow the existing TypeScript and Next.js patterns
  and reuse shared validation, access-control, session, and rate-limit helpers.
- For a behavioral bug fix, add a regression test under `tests/regression/`, describe the
  root cause briefly, and register it in `tests/regression/README.md`. Update tests
  that intentionally asserted behavior your change replaces; preserve meaningful
  assertions and coverage.
- Update the relevant admin documentation for feature, behavior, configuration,
  or workflow changes. Update host guides when host or guest behavior changes.
- For translations in `messages/`, compare with `messages/en-US.json`. Preserve
  message keys, ICU arguments, plural/select cases, and formatting placeholders.
  Flag missing or unclear source strings rather than silently changing their meaning.
- Keep dependency changes separate from unrelated features. Explain why an update
  is needed and preserve the existing security overrides and coordinated version
  constraints unless the change explicitly addresses them.
- Keep generated output, local data, credentials, and unrelated formatting changes
  out of the diff. Review and understand everything you submit, including work
  produced with automated tools.

## Validation

Run checks relevant to the change and report the actual commands and results.
Format edited Markdown, JSON, YAML, TypeScript, and other supported files with
Prettier. For issue forms, also check YAML structure against GitHub's
[issue-form syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms).

The repository normally ignores `.github/` during formatting. To check the
community templates explicitly, use:

```bash
npx prettier --check --ignore-path /dev/null .github/ISSUE_TEMPLATE/*.yml .github/PULL_REQUEST_TEMPLATE.md
```

For application, test, refactoring, or tooling changes, run:

```bash
scripts/preflight.sh --fast
```

For database migrations, authentication, public RSVP flows, or release-critical
changes, run the full check, including browser tests:

```bash
scripts/preflight.sh
```

Both modes use isolated PostgreSQL and Redis containers. The full check also
uses port 3001 for its temporary app. See the local development guide for details.
If a check cannot run or fails, state that explicitly in the pull request; the
maintainer decides whether an exception is acceptable. Do not report an unrun
check as passing.

## Pull requests

Use the pull request template to describe the problem, resulting behavior,
verification, and documentation impact. Link the relevant issue, and include
screenshots for visible UI changes when helpful. Explain dependency, migration,
or compatibility implications that a reviewer needs to assess.

Maintainers review scope, apply the appropriate release label, and handle merging
and releases. Keep discussion respectful and focused on the work. The
[Codex agent guide](AGENTS.md) and [Codex workflow](WORKFLOW.md) contain the
additional instructions for automated work in this repository.

## License and contributions

Contributions intentionally submitted for inclusion in RSVP to Me are licensed
under the project's **GNU Affero General Public License, version 3 only**
(`AGPL-3.0-only`); see [LICENSE](LICENSE). You retain copyright in your work.
No copyright assignment or separate contributor license agreement is required.
Submit only work you have the right to contribute, and preserve any applicable
third-party license and attribution notices.
