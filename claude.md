Aqui está a versão otimizada para ficar abaixo de 200 linhas, mantendo as 16 seções:

```md
# AtendeAi — Claude Code Operating Guide

## 1. Project Context
AtendeAi is a multi-tenant SaaS for small/medium businesses in Brazil, covering CRM, WhatsApp/Instagram messaging, scheduling, commerce, billing, inventory sync, AI auto-reply, prospecting, payment recovery and support.
Architecture:
- Monorepo: `src/api` NestJS backend, `src/app` mobile, `src/web` landing/dashboard.
- Backend: NestJS 11, TypeScript, Prisma, PostgreSQL, Redis, BullMQ.
- Modules: `src/api/modules/`.
- Shared layer: `src/api/shared/`.
- Infrastructure: Docker Compose local, Terraform/ECS production.
Main modules:
`agent-rules`, `ai`, `alerts`, `auth`, `billing`, `catalog`, `commerce`, `contact`, `dashboard`, `inventory`, `messaging`, `payment`, `platform-admin`, `proposal`, `prospecting`, `recovery`, `sales`, `scheduling`, `social`, `support`, `tenant`.

---

## 2. Core Operating Principle
Use **spec-driven development** with **verification gates**.
Always follow:
    Understand → Inspect existing patterns → Plan → Implement → Test → Verify → Report
Use the project skill when the task needs structure:
    C:\Users\Admin\Desktop\AtendeAi\.skills\tlc-spec-driven\SKILL.md
Use it for features, refactors, unclear bug fixes, architecture changes, database changes, multi-module work, risky flows, planning and validation.

---

## 3. Task Classification
Before coding, classify the task:
| Type | Required behavior |
|---|---|
| Quick fix | inspect, small plan, implement, test, report |
| Medium task | brief spec, plan, implementation, tests, verification |
| Large feature | spec, design, tasks, implementation, validation |
| Risky/complex | stop, clarify, then use full spec-driven flow |
Risky areas: auth, permissions, billing, payment, recovery, tenant isolation, Prisma schema, queues/workers, cross-module communication and external integrations.

---

## 4. Spec-Driven Flow
For non-trivial work, use:
    .specs/
      project/STATE.md
      features/feature-name/spec.md
      features/feature-name/design.md
      features/feature-name/tasks.md
      features/feature-name/validation.md
      quick/task-name/TASK.md
      quick/task-name/SUMMARY.md
Maintain traceability:
    Requirement → Task → Files changed → Tests → Verification
Rules:
- Do not implement behavior outside the spec.
- If the spec is unclear, ask before coding.
- For small tasks, use a lightweight quick task file.
- Update `.specs/project/STATE.md` when the project state changes.

---

## 5. Architecture Rules
Follow Clean Architecture:
    domain → application → infrastructure → presentation
Rules:
- One use case per class.
- Use cases implement `IUseCase<I, O>`.
- Ports live in `application/ports/`.
- Adapters live in `infrastructure/`.
- Controllers must not contain business logic.
- Prisma access should stay in infrastructure/repositories.
- Use existing entities, value objects and domain events.
- Prefer existing patterns before introducing new ones.
Cross-module communication:
- Use facades, ports or public module contracts.
- Never import internal classes from another module directly.
- Use existing string-based DI tokens, such as `SOCIAL_PLATFORM_ADAPTER` and `MESSAGING_FACADE`.

---

## 6. Multi-Tenancy Rules
Tenant isolation is mandatory.
Every tenant-owned query must filter by `tenantId`.
Always verify:
- Reads are scoped by `tenantId`.
- Writes include the correct `tenantId`.
- Updates/deletes are scoped by `tenantId`.
- Queue jobs carry tenant context when required.
- Event handlers preserve tenant context.
- Tests cover tenant isolation when data access is involved.
Never:
- Trust `tenantId` from request body when authenticated context exists.
- Expose cross-tenant data.
- Query tenant-owned records without tenant scope.
- Create tenant-owned records without tenant association.
If tenant ownership is unclear, stop and ask.

---

## 7. Database Rules
Rules:
- No runtime DDL.
- All schema changes must use Prisma migrations.
- Do not edit generated Prisma client files.
- Check existing schema conventions before changing models.
- Prefer tenant-scoped uniqueness when applicable.
- Add indexes for tenant-scoped lookups when needed.
After Prisma schema changes, run:
    cd src/api && npx prisma generate
    cd src/api && npx prisma migrate dev
If migration impact is unclear, stop and ask.

---

## 8. Code Conventions
File naming:
- Classes/services: `PascalCase`.
- Module folders: `kebab-case`.
- Unit tests: `*.spec.ts`.
- E2E tests: `*.e2e-spec.ts`.
- Prefer tests inside module `__tests__/`.

TypeScript:
- No implicit `any`.
- Avoid unsafe casts.
- Handle null/undefined explicitly.
- Keep classes small.
- Max 7 constructor params; if more are needed, decompose.
Path aliases:
- `@shared/*` → `shared/*`
- `@modules/*` → `modules/*`

---

## 9. Testing Rules
Use Jest.
Unit tests are required for new use cases, domain services, value objects, guards/policies, failure paths and tenant isolation logic.
E2E tests are required when changing controllers, auth flows, permissions, tenant boundaries, HTTP-visible database behavior or critical business flows.
Bug fixes should include regression tests when practical.

---

## 10. Verification Gates
Run the narrowest useful checks first.
For API changes:
    cd src/api && npm run lint
    cd src/api && npm test
    cd src/api && npm run build
For E2E-impacting changes:
    cd src/api && npm run test:e2e
From repo root when needed:
    npm run build:api
For Prisma changes:
    cd src/api && npx prisma generate
If a command cannot be run, report it clearly. Never claim verification passed if it was not run.

---

## 11. AI Agent Rules
1. Never modify `.env` files.
2. Never commit secrets.
3. Never invent APIs, files, env vars or business rules.
4. Always inspect similar code before adding new patterns.
5. Respect module boundaries.
6. Use ports/facades for cross-module access.
7. Use domain exceptions.
8. Never swallow errors silently.
9. Do not add functionality outside the request/spec.
10. Keep changes atomic.
11. Prefer readable, maintainable code over clever code.
12. If unsure, say what is uncertain and ask.

---

## 12. Stop Conditions
Stop and ask before continuing if:
- Tenant ownership is unclear.
- Requirements conflict with architecture.
- Billing/payment/recovery behavior is ambiguous.
- Auth or permission behavior is risky.
- Prisma migration impact is unclear.
- External credentials/env vars are missing.
- Tests fail for unrelated reasons.
- Implementation requires broad unrelated changes.
- The request would break module boundaries.

---

## 13. Key Commands
Development:
    npm run dev:api
    npm run dev:web
    npm run stack:up
Build:
    npm run build:api
API:
    cd src/api && npm run lint
    cd src/api && npm test
    cd src/api && npm run test:e2e
    cd src/api && npm run build
Database:
    cd src/api && npx prisma generate
    cd src/api && npx prisma migrate dev

---

## 14. Key Files
| Purpose | Path |
|---|---|
| App module | `src/api/app.module.ts` |
| Prisma schema | `src/api/prisma/schema.prisma` |
| Shared domain | `src/api/shared/domain/` |
| Event bus | `src/api/shared/infrastructure/event-bus/` |
| Use case interface | `src/api/shared/application/IUseCase.ts` |
| Shared ports | `src/api/shared/application/ports/` |
| Architectural review | `docs/ARCHITECTURAL-REVIEW-2026.md` |
| Project state | `.specs/project/STATE.md` |
| Spec skill | `.skills/tlc-spec-driven/SKILL.md` |

---

## 15. Final Response Format
At the end of each task, respond with:
    ## Summary
    - What changed
    ## Files Changed
    - `path/file.ts` — reason
    ## Verification
    - `command` — pass/fail/not run
    ## Traceability
    - Requirement/task → files → tests
    ## Notes
    - risks, assumptions or follow-ups
For quick fixes, keep the response shorter but always include verification status.

---

## 16. Commit Rules
Use Conventional Commits:
    feat(messaging): add retry policy
    fix(billing): scope invoice query by tenantId
    refactor(auth): extract session validator
    test(recovery): cover overdue payment flow
    docs(specs): update scheduling requirements
    chore(api): regenerate prisma client
Rules:
- One logical change per commit.
- Do not mix refactor and behavior change unless necessary.
- Include tests with the implementation when possible.
- Use the affected module as scope when possible.
```
