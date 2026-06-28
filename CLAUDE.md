# Claude Code Instructions

**Always read and adhere to `AGENTS.md` before making any changes.**

## Mandatory documentation updates (before pushing / opening a PR)

Documentation is part of the change, not a follow-up. Update it **before** you push or open a PR:

- **Every feature change requires an admin documentation update** under `docs/admin/` — no exceptions. This covers any new feature, behavior change, new/changed setting, environment variable, flag, or workflow.
- Any change affecting **self-hosting/operations, the guest experience, or user-facing UX/UI** also requires a **host documentation** update under `docs/host/` (the `/help` guides).
- When a change touches both audiences, update both. Only pure internal refactors with zero behavior/config/UX impact are exempt — and say so explicitly in the PR.

See the **Mandatory Documentation Updates** rule in `AGENTS.md` for the full policy.
