# UPcar

Plataforma de corridas por negociação (estilo InDrive): passageiros publicam uma corrida com o preço que querem pagar, motoristas fazem contra-ofertas, e um combina o preço com o outro antes da viagem começar.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/rideshare-app run dev` — run the frontend (artifact "UPcar", preview path `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (already provisioned by Replit)
- Optional env (features degrade gracefully if unset): `JWT_SECRET` (has a dev fallback), `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` (WhatsApp notifications are best-effort, failures are only logged), `AGENT_API_KEY` (gates the `/api/agent/*` routes used by an external WhatsApp AI agent integration — not required for the app itself)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, custom JWT + sha256 password hashing (not Clerk/Replit Auth — ported from the original project)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite, wouter for routing, Leaflet for maps (OpenStreetMap tiles, no API key needed), Radix UI primitives
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/rideshare-app` — frontend (passenger, driver, and admin flows)
- `artifacts/api-server/src/routes` — REST routes: auth, users, drivers, rides, offers, admin, feedbacks, proxy (geocoding/CEP/routing), dispatch, agent (WhatsApp AI agent hooks)
- `lib/db/src/schema` — users, driver-profiles, rides, offers, feedbacks, activity-log, messages, webauthn-credentials
- `lib/db/src/seed.ts` — seeds a few default/test accounts on server start (owner/admin, test passenger, test driver)
- `lib/api-spec/openapi.yaml` — source of truth for the API contract

## Architecture decisions

- This app was imported from an existing GitHub repo (`Ride-Management-Hub`) that already used this same pnpm/artifacts monorepo scaffold, so it was merged in directly rather than rebuilt from scratch.
- WhatsApp notifications (via Twilio) and the `/api/agent/*` routes (for an external WhatsApp AI agent) are optional integrations — the app works fully without their credentials configured; missing credentials only silently skip those specific features.
- Auth uses a custom JWT + sha256 scheme carried over from the original project, not Clerk or Replit Auth.

## Product

- Passageiros: pedem corrida com o preço que querem pagar, recebem contra-ofertas de motoristas, acompanham a corrida no mapa.
- Motoristas: veem corridas próximas, fazem ofertas, aceitam corridas agendadas.
- Admin: aprova/nega cadastro de motoristas, vê atividade e estatísticas, gerencia usuários e corridas agendadas.

## User preferences

- User is a non-technical, Portuguese-speaking user — communicate progress in plain Portuguese without jargon.

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after editing `lib/api-spec/openapi.yaml`.
- Seed accounts (created automatically on first server start): `passageiro@teste.com` / `test123`, `motorista@teste.com` / `test123`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
