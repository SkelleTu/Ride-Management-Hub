---
name: React Query v5 + Orval generated hooks
description: How to correctly pass query options into Orval-generated useQuery hooks under this workspace's @tanstack/react-query v5 catalog pin.
---

This workspace's catalog pins `@tanstack/react-query` to v5. Two behavior changes from v4 that
commonly break code ported from an older app (or written by someone assuming v4 semantics):

1. `onSuccess`/`onError` were removed from `useQuery` options in v5 (they still exist on
   `useMutation`). Passing `onSuccess` inside a generated hook's `{ query: { ... } }` options
   object is a silent type error (`Property 'onSuccess' does not exist`). Replace with a
   `useEffect` that watches the returned `data`.
2. The generated hook's `query` options type is the full `UseQueryOptions`, which in v5 requires
   `queryKey` to be present even though the hook works fine without it at runtime — omitting it
   is a TS2741 type error. Import and call the paired `get<HookName>QueryKey(...params)` helper
   (exported alongside every generated hook) and pass it explicitly:
   `{ query: { queryKey: getGetActiveRidesQueryKey(), refetchInterval: ... } }`.

**Why:** the app was originally written against an older react-query major, so ported code often
uses v4-era patterns (`onSuccess` in queries, omitted `queryKey`) that only fail at typecheck
time, not at Orval codegen time.

**How to apply:** whenever `pnpm --filter <frontend> run typecheck` reports `queryKey` missing
or `onSuccess` not existing on a generated `use*` query hook's options, apply the two fixes above
rather than downgrading react-query or fighting the generated types.
