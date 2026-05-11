# AtendeAi — AI Agent Reference

## Project Overview

AtendeAi is a multi-tenant SaaS platform for small/medium businesses in Brazil. It provides CRM, messaging (WhatsApp/Instagram), scheduling, commerce, billing, inventory sync, AI-powered auto-reply, sales prospecting, and payment recovery — all unified in a single platform.

## Architecture

- **Monorepo** with 3 workspaces: `src/api` (NestJS), `src/app` (mobile), `src/web` (landing/dashboard)
- **Backend**: NestJS 11 + TypeScript + Prisma ORM + PostgreSQL + Redis + BullMQ
- **Module structure**: 21 domain modules under `src/api/modules/`
- **Shared layer**: `src/api/shared/` (domain primitives, event bus, guards, storage, redis, queue)
- **Workers**: messaging-worker, alerts-worker, scheduling-worker, prospect-search-worker
- **Infrastructure**: Terraform (ECS), Docker Compose for local dev

## Module List

`agent-rules` | `ai` | `alerts` | `auth` | `billing` | `catalog` | `commerce` | `contact` | `dashboard` | `inventory` | `messaging` | `payment` | `platform-admin` | `proposal` | `prospecting` | `recovery` | `sales` | `scheduling` | `social` | `support` | `tenant`

## Code Conventions

### File Naming
- **Classes/Services**: PascalCase (`ConversationSaleEvidenceService.ts`)
- **Modules**: kebab-case directories (`agent-rules/`)
- **Tests**: `*.spec.ts` (unit), `*.e2e-spec.ts` (e2e) in `__tests__/` folder per module

### Architecture Patterns
- **Clean Architecture**: domain → application → infrastructure → presentation
- **Ports & Adapters**: interfaces in `application/ports/`, implementations in `infrastructure/`
- **Use Cases**: one class per use case implementing `IUseCase<I, O>`
- **Domain**: `Entity<T>`, `AggregateRoot<T>`, `ValueObject<T>`, `DomainEvent`
- **Event Bus**: `IEventBus` port with BullMQ/RabbitMQ/Outbox implementations
- **DI Tokens**: string-based injection tokens (e.g., `SOCIAL_PLATFORM_ADAPTER`)
- **Facades**: cross-module communication via facade tokens (e.g., `MESSAGING_FACADE`)

### TypeScript
- `strictNullChecks: true`, `noImplicitAny: true`
- Path aliases: `@shared/*` → `shared/*`, `@modules/*` → `modules/*`
- Target: ES2021, Module: CommonJS

### Testing
- **Framework**: Jest
- **Unit tests**: mock dependencies, test use cases in isolation
- **E2E tests**: `jest --config ./test/jest-e2e.json`, full HTTP request cycle
- **Run**: `npm test` (unit), `npm run test:e2e` (e2e) from `src/api/`

### Git Conventions
- **Commits**: Conventional Commits (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`)
- **Scope**: module name (`feat(messaging):`, `fix(billing):`)
- **Atomic commits**: one logical change per commit

## Known Architectural Debt (Priority Order)

### 1. Runtime DDL (CRITICAL — 7 modules)
Modules that create/alter tables at runtime via `ensureInfrastructure()`, `ensureTableShape()`, `ensureTable()`, `ensureColumns()`:
- Commerce, Inventory, Alerts, Contact, Sales, Recovery, Billing

**Fix**: Migrate all DDL to Prisma migrations. Remove runtime schema manipulation.

### 2. Boundary Violations (GRAVE)
Modules importing internal classes from other modules instead of using ports/facades:
- Scheduling → imports `PrismaConversationRepository` from Messaging
- AI → imports `AdvanceCommerceConversationUseCase` from Commerce
- AI → imports `ReserveProfessionalSlotUseCase` from Scheduling
- Sales → instantiates `DeepSeekAdapter` directly (duplicates AI module binding)

**Fix**: Create port interfaces in consuming module, implement adapters that delegate to facades.

### 3. God Classes (GRAVE)
Services/controllers with excessive dependencies (10-17 params):
- `ProcessAIResponseService` (14 deps)
- `AdvanceCommerceConversationUseCase` (12 deps)
- `CommerceController` (17 deps)
- `ReserveProfessionalSlotUseCase` (10 deps)

**Fix**: Decompose into pipeline steps, extract sub-use-cases, apply Strategy/Chain of Responsibility.

### 4. Reliability Issues
- `setTimeout` for delayed operations (Social DM, Billing plan changes) — use BullMQ delayed jobs
- No circuit breaker for external APIs (Instagram, Asaas, ERPs)
- Redis as primary store for scheduling data (risk of data loss)
- OutboxDispatcher without leader election (redundant polling in multi-instance)

## Commands

```bash
# Development
npm run dev:api              # Start API in watch mode
npm run dev:web              # Start web in dev mode
npm run stack:up             # Docker compose full stack

# Build
npm run build:api            # NestJS build

# Test
cd src/api && npm test       # Unit tests
cd src/api && npm run test:e2e  # E2E tests

# Database
cd src/api && npx prisma migrate dev    # Run migrations
cd src/api && npx prisma generate       # Generate client

# Lint
cd src/api && npm run lint   # ESLint with fix
```

## Implementation Waves (Architectural Improvements)

### Wave 1 — Runtime DDL Elimination
Remove all `ensureInfrastructure()` / `ensureTableShape()` / `ensureTable()` / `ensureColumns()` patterns. Create proper Prisma migrations for any tables/columns not yet in schema.prisma.

### Wave 2 — Boundary Enforcement
Create port interfaces for cross-module dependencies. Replace direct imports with facade-based communication. Modules should only depend on their own ports + shared layer.

### Wave 3 — God Class Decomposition
Break services with >7 dependencies into smaller, focused units. Apply pipeline pattern for complex flows (AI response, commerce conversation, inbound message processing).

### Wave 4 — Reliability Hardening
Replace `setTimeout` with BullMQ delayed jobs. Add circuit breakers for external API calls. Persist scheduling data in PostgreSQL (Redis as cache only). Add leader election to OutboxDispatcher.

## Key Files

| Purpose | Path |
|---------|------|
| App module | `src/api/app.module.ts` |
| Prisma schema | `src/api/prisma/schema.prisma` |
| Shared domain | `src/api/shared/domain/` |
| Event bus | `src/api/shared/infrastructure/event-bus/` |
| Use case interface | `src/api/shared/application/IUseCase.ts` |
| Ports | `src/api/shared/application/ports/` |
| Architectural review | `docs/ARCHITECTURAL-REVIEW-2026.md` (parts 1-4) |
| Project state | `.specs/project/STATE.md` |

## Rules for AI Agents

1. **Never modify** `.env` files or commit secrets
2. **Always run** `npm run build:api` after code changes to verify compilation
3. **Atomic commits** — one logical change per commit with conventional commit message
4. **Respect module boundaries** — never import internal classes across modules; use ports/facades
5. **No runtime DDL** — all schema changes go through Prisma migrations
6. **Test coverage** — new features require at least unit tests for use cases
7. **Multi-tenancy** — every query MUST filter by `tenantId`; never expose cross-tenant data
8. **Error handling** — use domain exceptions, never swallow errors silently
9. **Prefer existing patterns** — check how similar things are done in the codebase before introducing new patterns
10. **Max 7 constructor params** — if a class needs more, decompose it
