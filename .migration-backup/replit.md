# RideApp — InDrive Clone (Brasil)

RideApp é um aplicativo de corridas para o mercado brasileiro com negociação de preço estilo InDrive, cadastro de motoristas com aprovação administrativa, e mapa interativo Leaflet.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/rideshare-app run dev` — Frontend Vite (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS v4 + shadcn/ui (dark theme, electric green accent)
- Map: Leaflet (dark CARTO tiles, centered on São Paulo by default)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → `lib/api-client-react`)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/rideshare-app/src/` — React frontend
  - `pages/` — passenger/, driver/, admin/, auth/, index.tsx (role selection)
  - `components/map/MapView.tsx` — Leaflet map component
  - `lib/auth.tsx` — AuthContext with token/role management
  - `lib/gps.ts` — GPS deep-link helpers (Google Maps, Waze, Apple Maps)
  - `main.tsx` — sets up `setAuthTokenGetter` so all API calls carry Bearer token
- `artifacts/api-server/src/` — Express backend
  - `routes/` — auth, users, drivers, rides, offers, admin
  - `lib/auth.ts` — token generation, in-memory token store, middleware
- `lib/api-client-react/` — generated React Query hooks + Zod schemas (Orval)
- `lib/db/` — Drizzle schema: users, driver_profiles, rides, offers, activity_log
- `lib/api-spec/` — OpenAPI spec source of truth

## Architecture decisions

- **InDrive fare negotiation**: Passengers post a ride with an offered price; drivers send counter-offers; passenger accepts/rejects each. Ride transitions: open → negotiating → accepted → in_progress → completed.
- **Auth**: In-memory token store (`Map<token, userId>`) on the server; `localStorage` on the client; `setAuthTokenGetter` wired in `main.tsx` so all Orval-generated hooks auto-send `Authorization: Bearer <token>`.
- **Driver approval flow**: Drivers submit a multi-step profile form; admins review and approve/deny from `/admin/drivers/:id`; denied drivers can resubmit.
- **GPS deep-links**: On "A Bordo" (driver picked up passenger), opens GPS to origin; on "Viagem Iniciada" (trip started), opens GPS to destination. Supports Google Maps, Waze, and browser fallback.
- **Express 5 `req.params` typing**: All `parseInt(req.params.id)` calls require `String()` cast (`parseInt(String(req.params.id))`) because Express 5 types `params` as `string | string[]`.

## Product

- **Role selection** on app open: Passageiro (Solicitar viagens) or Motorista (Oferecer viagens)
- **Passageiro**: Request ride on map with offered price, receive driver offers, accept/reject, track active ride
- **Motorista**: Browse open ride requests, send price offers with optional message, navigate with GPS deep-links
- **Motorista cadastro**: Multi-step registration form (personal info, CNH, vehicle, docs) pending admin approval
- **Admin dashboard**: Stats overview, pending driver approvals, ride monitoring, user management

## Seeded accounts

| Email | Password | Role |
|---|---|---|
| admin@rideapp.com | admin123 | admin |
| maria@exemplo.com | senha123 | passenger |
| joao@exemplo.com | senha123 | passenger |
| carlos@exemplo.com | senha123 | driver |
| ana@exemplo.com | senha123 | driver |

## Gotchas

- After editing any backend source file, restart the `artifacts/api-server: API Server` workflow to rebuild + restart.
- `leaflet` is installed as a direct dep in `artifacts/rideshare-app/package.json` (not in workspace catalog).
- The API server mounts all routes under `/api`: `app.use("/api", router)`. Services must handle their full base path.
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing the OpenAPI spec.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
