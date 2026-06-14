# UPcar

A full-stack ride-sharing platform with dedicated interfaces for passengers, drivers, and administrators.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 3000)
- `pnpm --filter @workspace/rideshare-app run dev` — run the frontend (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- API: Express 5 (port 3000)
- Frontend: React 19 + Vite (port 5000), Tailwind CSS 4, Radix UI, Wouter
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Auth: Custom JWT-based auth with bcrypt password hashing

## Where things live

- `artifacts/api-server/` — Express backend
- `artifacts/rideshare-app/` — React frontend
- `lib/db/` — Drizzle schema and migrations (source of truth for DB shape)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-zod/` — Zod schemas auto-generated from OpenAPI spec
- `lib/api-client-react/` — React hooks auto-generated from OpenAPI spec

## Architecture decisions

- Monorepo with pnpm workspaces: api-server, rideshare-app, and shared libs (db, api-spec, api-zod, api-client-react)
- Frontend proxies `/api` requests to the API server (port 3000) via Vite dev server proxy
- JWT tokens stored client-side; `requireAuth` middleware validates on every protected route
- Drizzle ORM with `push` for dev schema changes; migrations tracked in `lib/db/migrations/`
- Auto-backup runs on server start and every 24h, saving a JSON snapshot of all tables

## Product

- **Passenger flow**: register/login → request a ride → track driver → rate trip
- **Driver flow**: register/login → set online status → accept ride offers → complete rides
- **Admin panel**: manage users, view activity logs, monitor platform stats

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any change to `openapi.yaml` — it regenerates `api-zod` and `api-client-react`
- The `artifacts/api-server/src/src/` directory is a stale duplicate — actual source is in `artifacts/api-server/src/`
- JWT secret falls back to a dev default if `JWT_SECRET` env var is not set; set it in production

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
