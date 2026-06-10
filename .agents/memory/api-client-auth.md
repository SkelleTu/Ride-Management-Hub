---
name: API client auth token wiring
description: setAuthTokenGetter must be called in main.tsx for all Orval-generated hooks to send Bearer tokens automatically
---

The Orval-generated `customFetch` in `lib/api-client-react/src/custom-fetch.ts` has a `_authTokenGetter` that is null by default. If not configured, all generated hooks omit the `Authorization` header — only hooks that explicitly pass `request: { headers: { Authorization: ... } }` will send the token.

**Rule:** Call `setAuthTokenGetter(() => localStorage.getItem("token"))` in `main.tsx` (before rendering) for all hooks to auto-attach the token.

**Why:** The design is that the getter is injectable (useful for SSR, Expo, etc.). Forgetting to call it means authenticated endpoints 401 on every request except the ones that manually pass headers.

**How to apply:** In `main.tsx`, import `setAuthTokenGetter` from `@workspace/api-client-react` and call it with the token source before `createRoot(...).render(...)`.
