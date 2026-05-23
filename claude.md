# AtendeAi — Claude Code Operating Guide

## 1. Project Context
AtendeAi: multi-tenant SaaS (Brazil). CRM, messaging (WhatsApp/Instagram), scheduling, commerce, billing, inventory sync, AI auto-reply, prospecting, recovery, support.
Architecture: NestJS 11 (`src/api`), mobile (`src/app`), web (`src/web`). PostgreSQL, Prisma, Redis, BullMQ. Docker Compose local, Terraform/ECS prod.
Modules: `agent-rules`, `ai`, `alerts`, `auth`, `automation`, `billing`, `catalog`, `commerce`, `contact`, `dashboard`, `inventory`, `messaging`, `payment`, `platform-admin`, `proposal`, `prospecting`, `recovery`, `sales`, `scheduling`, `social`, `support`, `tenant`, `voice`.

---

## 2. Core Operating Principle & Workflow Orchestration
Use **spec-driven development** + **verification gates** + **on-demand skill/agent routing**.
Always: `Understand → Inspect patterns → Plan → Implement → Test → Verify → Report`.

**Full pipeline (large/risky features) — each error dies at the cheapest stage:**
| # | Phase | Use | Gate |
|---|---|---|---|
| 1 | Detail | `technical-design-doc-creator` skill | design doc written |
| 2 | Architect | `nestjs-modular-monolith` / `tactical-ddd` | boundaries decided **up front** |
| 3 | Map | `tlc-spec-driven` skill | tasks with acceptance criteria + traceability |
| 4 | Implement | subagent per task, **TDD red→green→refactor** | each task closes with its test green |
| 5 | Auto-gate | `lint + typecheck + test + build` (§10) | all pass, else back to 4 |
| 6 | Completeness | `tlc-spec-driven` validation | all tasks done, traceability complete |
| 7 | Review | `/code-review` + checklists: tenant (§6), boundaries (§5), Prisma (§7) | approved |
| 8 | Ship | `/ship-pr` | **atomic commits** (1 logical change), PR |

Cost control — right-size by §3 (do NOT run the full pipeline on everything):
- **Quick fix:** implement → auto-gate (5) → ship (8). Skip 1-3, 6-7.
- **Medium:** map (3) → implement → gate → review → ship. Skip design doc unless unclear.
- **Large/risky:** full 1-8.
- **Refactor:** skip design doc (1); architect (2) only if boundaries change; review (7) for risky/core, skip for obvious.

Routing rules:
- Architect decides boundaries **before** implementation (front-loaded), never reviewed only at the end.
- Auto-gate (5) before review (7): cheap checks catch most errors; never review uncompilable code.
- One subagent per independent task; parent verifies subagent output before integrating.
- Commits are atomic (1 logical change = N files), never per-file.

---

## 3. Task Classification
Classify before coding; this picks which §2 steps run (cost control).
| Type | §2 steps |
|---|---|
| Quick fix | 4 → 5 → 8 (implement, auto-gate, ship) — **non-bug only** (config, copy, rename, dep bump) |
| Bugfix | diagnose → red test → green fix → 5 → 7 → 8 (review **never** skipped) |
| Medium | 3 → 4 → 5 → 7 → 8 |
| Large | full 1 → 8 |
| Risky/complex | stop, clarify, then full 1 → 8 |
Risky areas (bias toward full pipeline + review): auth, permissions, billing, payment, recovery, tenant isolation, Prisma schema, queues/workers, cross-module communication, external integrations.

**Bugfix pipeline (any reported bug — mandatory, enforced by hooks):**
1. **Diagnose** — `context-mode:diagnose` skill: reproduce → minimise → hypothesise root cause. No fix before reproduce.
2. **Red** — write a regression test (`*.spec.ts` / `*.e2e-spec.ts`) that fails on current code. TDD via `context-mode:tdd`.
3. **Green** — minimal fix until red test passes. No scope creep (CLAUDE.md "Doing tasks").
4. **Auto-gate (5)** — lint + typecheck + test + build.
5. **Review (7)** — `/code-review`. Never skipped for bugfixes.
6. **Ship (8)** — `/ship-pr`, commit `fix(module): …`.
Enforcement: `bugfix-test-gate.js` blocks a `fix()` commit with no test staged (override `(no-regression-test: <reason>)`). `review-gate.js` blocks push/PR without a fresh `/code-review` marker. Root cause over symptom — never patch only the symptom.

---

## 4. Spec-Driven Flow
For non-trivial work, create `.specs/` structure. Maintain traceability: `Requirement → Task → Files → Tests → Review → PR`.
Rules:
- Do not code outside the spec. Ask if unclear.
- Use lightweight quick task file for small work.
- Update `.specs/project/STATE.md` when state changes.

---

## 5. Architecture Rules
Clean Architecture: `domain → application → infrastructure → presentation`.
- One use case per class; implement `IUseCase<I, O>`.
- Ports in `application/ports/`, adapters in `infrastructure/`.
- Controllers = no business logic. Prisma access = `infrastructure/repositories`.
- Use existing entities, value objects, domain events, patterns.
Cross-module: Use facades/ports/contracts, never import internals directly. Use string-based DI tokens (`SOCIAL_PLATFORM_ADAPTER`, `MESSAGING_FACADE`).

---

## 6. Multi-Tenancy Rules
Tenant isolation is **mandatory**. Every tenant-owned query must filter by `tenantId`.
Verify: reads scoped, writes include tenantId, updates/deletes scoped, queue jobs carry context, event handlers preserve context, tests cover isolation.
Never: trust tenantId from body (use auth context), expose cross-tenant data, query without scope, create without association.
If tenant ownership unclear: stop and ask.

---

## 7. Database Rules
- No runtime DDL.
- All schema changes via Prisma migrations.
- Do not edit generated Prisma client.
- Check existing schema conventions.
- Prefer tenant-scoped uniqueness & indexes for tenant lookups.
After schema changes: `npx prisma generate` + `npx prisma migrate dev`.

---

## 8. Code Conventions
**File naming:** Classes/services = `PascalCase`, modules = `kebab-case`, tests = `*.spec.ts` (unit) / `*.e2e-spec.ts` (E2E), prefer `__tests__/` inside modules.
**TypeScript:** No implicit `any`, no unsafe casts, explicit null/undefined, small classes, max 7 constructor params.
**Path aliases:** `@shared/*` → `shared/*`, `@modules/*` → `modules/*`.

---

## 9. Testing Rules
Use Jest.
Unit tests required: new use cases, domain services, value objects, guards/policies, failure paths, tenant isolation logic.
E2E tests required: controllers, auth flows, permissions, tenant boundaries, HTTP-visible DB behavior, critical business flows.
Bug fixes: include regression tests when practical.

---

## 10. Verification Gates
Run narrowest useful checks first.
API changes: `cd src/api && npm run lint && npm test && npm run build`.
E2E impact: `cd src/api && npm run test:e2e`.
Prisma changes: `npx prisma generate`.
Repo build: `npm run build:api` from root.
Report clearly if a command cannot run. Never claim verification without proof.

---

## 11. AI Agent Rules
1. Never modify `.env`.
2. Never commit secrets.
3. Never invent APIs, files, env vars, business rules.
4. Inspect similar code before adding patterns.
5. Respect module boundaries; use ports/facades.
6. Use domain exceptions. Never swallow errors silently.
7. Do not code outside spec. Keep changes atomic.
8. Readable, maintainable code over clever.
9. Unsure? State uncertainty and ask.

---

## 12. Stop Conditions
Stop and ask before continuing if:
- Tenant ownership unclear.
- Requirements conflict architecture.
- Billing/payment/recovery behavior ambiguous.
- Auth/permission behavior risky.
- Prisma migration impact unclear.
- External credentials/env vars missing.
- Tests fail for unrelated reasons.
- Implementation requires broad unrelated changes.
- Request would break module boundaries.

---

## 13. Key Commands
**Dev:** `npm run dev:api`, `npm run dev:web`, `npm run stack:up`.
**Build:** `npm run build:api`.
**API:** `cd src/api && npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`.
**Database:** `npx prisma generate`, `npx prisma migrate dev`.

---

## 14. Key Files & Skills
| Purpose | Reference |
|---|---|
| App module | `src/api/app.module.ts` |
| Prisma schema | `src/api/prisma/schema.prisma` |
| Shared domain | `src/api/shared/domain/` |
| Event bus | `src/api/shared/infrastructure/event-bus/` |
| Use case interface | `src/api/shared/application/IUseCase.ts` |
| Shared ports | `src/api/shared/application/ports/` |
| Project state | `.specs/project/STATE.md` |
| Architectural review | `docs/ARCHITECTURAL-REVIEW-2026.md` |
| Design docs | `technical-design-doc-creator` skill |
| Architect | `nestjs-modular-monolith`, `tactical-ddd` skills |
| Spec-driven | `tlc-spec-driven` skill |
| Code review | `/code-review` skill |
| Ship PR | `/ship-pr` skill |

---

## 15. Final Response & Commit Format
**Response format (end of task):**
```
## Summary
- What changed

## Files Changed
- path/file.ts — reason

## Verification
- command — pass/fail/not run

## Traceability
- Requirement → task → files → tests → PR

## Notes
- risks, assumptions, follow-ups
```
For quick fixes, shorter but always include verification status.

**Commits (Conventional):**
```
feat(module): summary
fix(module): summary
refactor(module): summary
test(module): summary
docs(specs): summary
chore(api): summary
```
Rules: One logical change per commit. No mixing refactor + behavior change unless needed. Include tests with implementation. Use affected module as scope.
