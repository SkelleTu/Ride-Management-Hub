---
name: Orval zod codegen + format:email
description: Why an OpenAPI `format: email` field breaks the zod codegen build in this stack, and the fix.
---

Orval's zod client (v8.20+) compiles `format: email` into a top-level `zod.email()` call.
That function only exists on the `zod/v4` entrypoint — this workspace's zod catalog version
(3.25.x) still resolves the plain `zod` import to the v3 API, which has no top-level `.email()`.
The result is a `tsc --build` failure inside `lib/api-zod/src/generated/api.ts` right after
codegen looks like it succeeded (Orval itself reports success; the chained
`typecheck:libs` step is what fails).

**Why:** `zod` package ships v3 as default export and v4 only under `zod/v4`; Orval's zod
client output imports plain `zod`, not `zod/v4`, so any schema construct that only exists in
v4 (like `.email()`) will not compile.

**How to apply:** When writing `lib/api-spec/openapi.yaml`, don't use `format: email` (or other
v4-only zod string formats) on string properties — just use `type: string`. If email format
validation is actually needed, validate it in route code instead of relying on the generated
zod schema.
