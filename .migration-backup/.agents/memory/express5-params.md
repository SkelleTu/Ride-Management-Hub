---
name: Express 5 params cast
description: req.params values are typed as string | string[] in Express 5 — must wrap with String() before parseInt
---

In Express 5, `req.params` is typed as `ParamsDictionary` where values are `string | string[]`, not plain `string`. This causes TypeScript errors like `Argument of type 'string | string[]' is not assignable to parameter of type 'string'`.

**Rule:** Always use `parseInt(String(req.params.id))` or `String(req.params.id)` before any string operation.

**Why:** Express 5 updated the type signature to be more accurate. The runtime value is still always a string, but TypeScript sees the union type and won't allow direct string operations.

**How to apply:** Any route handler that reads `req.params.*` and passes it to `parseInt`, `parseFloat`, or any string method — wrap in `String()` first.
