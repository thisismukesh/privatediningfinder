## Current
Task: T-04 Drizzle schema + migrations for §4.1-4.5 | Phase: 0
Next action: Write migration test asserting every table/enum/index/CHECK exists (incl. quote_verified=false rejection), then implement Drizzle schema + SQL migrations.

## Completed
T-01 ✓ Monorepo scaffold: pnpm workspace (pnpm-workspace.yaml), Turborepo (turbo.json), TS strict base (tsconfig.base.json), Prettier (.prettierrc.json). 6 packages: packages/{domain,db,providers,pipeline,evals}, apps/web. Each has package.json + tsconfig.json + vitest.config.ts + a smoke test. `pnpm test` green across all packages.
T-02 ✓ Purity enforcement: eslint.config.js (flat config, typescript-eslint + eslint-plugin-boundaries). Rules: no-restricted-globals blocks `fetch`, no-restricted-syntax blocks `new Date()`/`Date.now()`/`Math.random()`, no-restricted-imports blocks fs/http/https in packages/domain/**, boundaries/element-types blocks domain importing db/providers/pipeline/evals/web. Test: packages/domain/src/purity.lint.test.ts (spawns eslint against temp snippets, 6 cases, all green).
T-03 ✓ Postgres+PostGIS local dev: used `supabase init && supabase start` (Docker-based, §3.1 alternative) since psql/postgres are not natively installed on this machine. Script: scripts/db-setup.sh (idempotent, verified by running twice). DB at postgresql://postgres:postgres@127.0.0.1:54322/postgres, diner_test created with postgis/pg_trgm/uuid-ossp extensions. Test: packages/db/src/postgis.integration.test.ts (3 tests, green) — asserts PostGIS >=3.3, required extensions present, ST_Distance(Times Sq, Rockefeller Center) in a sane range.

## Decisions
- DINER.md and SPECS.md live in .claude/ not repo root (HANDOFF said root, but they were placed in .claude/ by the setup). Treating .claude/DINER.md and .claude/SPECS.md as canonical source docs; not moving them.
- Docker daemon was not running at session start; started Docker Desktop successfully.
- Local dev stack is Postgres 17.6 / PostGIS 3.3.7 (Supabase CLI's fixed local Docker image), not Postgres 16 / PostGIS 3.4+ as SPECS.md §1 originally pinned. Amended SPECS.md §1 and the T-03 row in §14 with a one-line rationale: no version-specific features are used (only geography, GIST, ST_Contains/ST_Distance, all present since PostGIS 2.x), so this is safe. Production still targets Supabase-hosted Postgres 16 per §3.3 (Supabase's hosted projects use whatever PG version Supabase provisions — will verify at T-90).
- packages/db vitest.config.ts defaults DATABASE_URL to the local diner_test connection string so integration tests run without manual env export.

## Blocked
(none)
