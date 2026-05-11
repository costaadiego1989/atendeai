# API module testing matrix

This file points from the monorepo docs to the living API testing specs committed next to the executable code.

## Detail

- Test spec index: [src/api/docs/testing/MODULE-TEST-SPEC-INDEX.md](../../src/api/docs/testing/MODULE-TEST-SPEC-INDEX.md)
- Central guarantee plan: [src/api/API-E2E-GUARANTEE-PLAN.md](../../src/api/API-E2E-GUARANTEE-PLAN.md)
- Per module: `src/api/modules/<module>/TEST-SPEC.md`

## Inventory snapshot

Generated from local files under `src/api/modules` on 2026-05-08.

| Module | Test files | E2E files | Risk note |
|--------|------------|-----------|-----------|
| tenant | 57 | 9 | Strong coverage; protect runtime and role matrix. |
| messaging | 38 | 19 | Very broad coverage; add provider golden files and ordering cases. |
| prospecting | 35 | 3 | Strong unit coverage; enforce async worker smoke. |
| ai | 19 | 3 | Good service coverage; harden provider failure contracts. |
| billing | 17 | 2 | Good domain coverage; add quota race tests. |
| contact | 14 | 3 | Solid CRM/timeline coverage; add identity merge edge cases. |
| sales | 14 | 2 | Good financial basics; add concurrent coupon and locale CSV cases. |
| auth | 12 | 3 | Good core coverage; harden cookie/throttle/session matrix. |
| proposal | 12 | 1 | Lifecycle covered; add auth/public-link hardening. |
| recovery | 12 | 1 | Good recovery coverage; add opt-out/payment race tests. |
| payment | 11 | 3 | Good PSP start; keep webhook idempotency central. |
| commerce | 10 | 1 | Good focused specs; add concurrent cart/session tests. |
| scheduling | 8 | 2 | Critical flow covered; many use cases still need targeted units. |
| inventory | 7 | 1 | Improved coverage; add provider failure matrix. |
| alerts | 4 | 0 | Missing e2e/worker idempotency confidence. |
| platform-admin | 4 | 0 | High-risk admin surface needs e2e authz matrix. |
| agent-rules | 3 | 2 | Needs stronger role/version/history guarantees. |
| social | 3 | 0 | Needs webhook signature/golden payload e2e. |
| catalog | 2 | 1 | Under-tested relative to 10 use cases. |
| support | 2 | 0 | Needs API and tenant-isolation e2e. |
| dashboard | 1 | 1 | Cross-module reporting slice; add tenant/status/date fixtures. |

## Relation to `MODULE-*.md`

- `docs/api-modules-review/MODULE-<module>.md` describes architecture, domain role, coupling, and maintainability.
- `src/api/modules/<module>/TEST-SPEC.md` describes scenario IDs, priority gaps, and test backlog.
- `src/api/API-E2E-GUARANTEE-PLAN.md` connects modules into full application flows.
