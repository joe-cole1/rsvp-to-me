## Description

This PR introduces optional support for **PostgreSQL** (database provider), **Redis** (session caching, rate-limiting, and cron synchronization locks), and a fully featured **Database Backups** management system (with automatic cron rotation and an admin UI).

### Key Features Implemented:
1. **Dynamic DB Layer:** Swaps between LibSQL/SQLite adapter and PostgreSQL at runtime using the `DATABASE_URL` prefix.
2. **Dual-Prisma Generation:** Automatic schemas compilation script (`scripts/generate-postgres-schema.ts`) to build both clients without conflict.
3. **Redis Store integrations:**
   - Session store caching (injected into `iron-session`).
   - Sliding-window rate limit counters.
   - Mutex locks on backgrounds tasks to prevent duplicated cron executions.
4. **Interactive Database Backups Dashboard:**
   - manual or scheduled snapshots (using `pg_dump` for postgres or file copy for SQLite).
   - Dynamic schedule sync: checks configuration tables every minute and hot-swaps active cron triggers.
   - Secure authenticated downloads (`app/api/admin/backups/[filename]`).
5. **Comprehensive Tests:** 237/237 tests pass, including new backup and Redis helper tests.
6. **Documentation Suite:** Exhaustive updates in `docs/` for configuring and upgrading/restoring databases.

Please refer to the walkthrough for full verification details.
