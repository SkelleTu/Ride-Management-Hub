---
name: UPcar (rideshare-app) pricing rules
description: Business decisions behind the shared fare-rounding utility, for consistency in future pricing changes.
---

- All rider-facing/driver-facing fare estimates must round to the nearest multiple of R$5 (never below R$5), via a single shared utility rather than per-page math.
- **Why:** user explicitly required rounding (17→15, 18→20, 26→25) shown transparently to both sides at calculation time; duplicated/divergent formulas previously existed in the passenger and driver flows.
- Passenger and driver keep intentionally different underlying rate formulas (passenger: flat R$/km; driver: base fare + R$/km, since it also covers deadhead distance to pickup) — only the rounding step and the "price map" address-based calculator were required to be unified/shared, not the rate formulas themselves.
- **How to apply:** any new fare display (new page, new role, new flow) should reuse the shared pricing helper/rounding function instead of reimplementing rate math, so the rounding rule stays consistent app-wide.
