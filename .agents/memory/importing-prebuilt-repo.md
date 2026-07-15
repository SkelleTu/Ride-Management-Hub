---
name: Importing a pre-built GitHub repo into this monorepo scaffold
description: Approach for importing an existing app (that already uses the same pnpm/artifacts scaffold) into a fresh Replit project, and the checks that reliably surface real integration bugs.
---

When a GitHub repo to import already uses this exact pnpm workspace / artifacts scaffold
(same `artifacts/`, `lib/db`, `lib/api-spec`, `lib/api-client-react` layout), a direct
file-level merge is far faster and safer than rebuilding from scratch:

1. Clone read-only first and diff structure before touching the real workspace.
2. Create the missing artifact(s) via the artifacts tooling (not by hand-editing toml), then
   overwrite its scaffolded `src/`/`public/`/config files with the imported ones.
3. Copy `lib/api-spec/openapi.yaml`, `lib/db/src/schema` + `seed.ts`, and
   `artifacts/api-server/src/{app,index,lib,routes}` from the import — watch for stale
   `src/src` duplicate directories some repos accumulate from prior migrations; only copy the
   real `src/`.
4. Merge (don't blindly replace) `package.json` dependencies — keep this workspace's catalog
   versions for anything already in the catalog, add the rest as direct versions.
5. Re-run codegen, `db push`, and **typecheck every touched package** — typecheck is what
   actually surfaces real integration bugs (spec/DB/frontend fields out of sync, e.g. a frontend
   using `user.accountStatus` or `ride.driverLat` that the imported OpenAPI spec never declared,
   even though the DB column existed). Don't skip straight to a screenshot; a page can render
   fine while several derived fields are silently `undefined`.
6. Only after typecheck is clean across api-server, the frontend, and libs, restart workflows
   and screenshot/curl a real request (e.g. login) to confirm end-to-end wiring.

**Why:** repos migrated between platforms (e.g. a prior Vercel migration attempt) often have
drifted OpenAPI specs relative to their own frontend/DB, plus leftover cruft directories
(`.migration-backup/`, `attached_assets/`, duplicate `src/src`) that must be excluded, not copied.
