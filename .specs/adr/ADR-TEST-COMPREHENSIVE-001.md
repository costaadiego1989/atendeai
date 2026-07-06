# ADR-TEST-COMPREHENSIVE-001 — Comprehensive Test Suite Implementation

**Status:** Accepted  
**Date:** 2025-06-18  
**Authors:** bug-finder agent, adr-architect agent, adr-implementer agent

---

## Context

An audit of the AtendeAI codebase identified significant coverage gaps across all 24 API modules and 21 frontend modules. The existing test suite (≈1,048 files) covered primarily happy paths and basic CRUD operations, leaving critical scenarios unmapped:

- **Race conditions** in BullMQ job processing and concurrent requests
- **Tenant isolation** — cross-tenant data leakage not tested
- **Input sanitization** — XSS and SQL injection vectors in name/description fields
- **Error path propagation** — HTTP 400/401/403/404/500 rarely asserted end-to-end
- **Boundary values** — null, undefined, empty string, negative numbers
- **Frontend integration** — React Query cache invalidation, optimistic updates, form-to-API flows

Modules with lowest coverage: `task` (1 file), `dashboard` (1 file), `social` (5 files), `support` (4 files). Frontend had near-zero test coverage for most modules.

---

## Decision

Implement a comprehensive test suite adding **225 new tests per module** across two layers:

### API Modules (24 modules × 225 tests = 5,400 tests)

| Module | Unit | Integration | E2E |
|--------|------|-------------|-----|
| agent-rules | 100 | 100 | 25 |
| ai | 100 | 100 | 25 |
| alerts | 100 | 100 | 25 |
| auth | 100 | 100 | 25 |
| automation | 100 | 100 | 25 |
| billing | 100 | 100 | 25 |
| catalog | 100 | 100 | 25 |
| commerce | 100 | 100 | 25 |
| contact | 100 | 100 | 25 |
| dashboard | 100 | 100 | 25 |
| inventory | 100 | 100 | 25 |
| messaging | 100 | 100 | 25 |
| payment | 100 | 100 | 25 |
| platform-admin | 100 | 100 | 25 |
| proposal | 100 | 100 | 25 |
| prospecting | 100 | 100 | 25 |
| recovery | 100 | 100 | 25 |
| sales | 100 | 100 | 25 |
| scheduling | 100 | 100 | 25 |
| social | 100 | 100 | 25 |
| support | 100 | 100 | 25 |
| task | 100 | 100 | 25 |
| tenant | 100 | 100 | 25 |
| voice | 100 | 100 | 25 |

### Frontend Modules (21 modules × 225 tests = 4,725 tests)

| Module | Unit | Integration | E2E |
|--------|------|-------------|-----|
| agent-rules | 100 | 100 | 25 |
| alerts | 100 | 100 | 25 |
| auth | 100 | 100 | 25 |
| automations | 100 | 100 | 25 |
| billing | 100 | 100 | 25 |
| catalog | 100 | 100 | 25 |
| checkout | 100 | 100 | 25 |
| contacts | 100 | 100 | 25 |
| dashboard | 100 | 100 | 25 |
| inventory | 100 | 100 | 25 |
| messaging | 100 | 100 | 25 |
| platform-admin | 100 | 100 | 25 |
| proposals | 100 | 100 | 25 |
| prospecting | 100 | 100 | 25 |
| recovery | 100 | 100 | 25 |
| sales | 100 | 100 | 25 |
| scheduling | 100 | 100 | 25 |
| settings | 100 | 100 | 25 |
| social | 100 | 100 | 25 |
| support | 100 | 100 | 25 |
| users | 100 | 100 | 25 |

**Total new tests: ~10,125** (45 modules × 225 tests)

---

## File Naming Convention

```
src/api/modules/{module}/__tests__/{module}.unit-new.spec.ts
src/api/modules/{module}/__tests__/{module}.integration-new.spec.ts
src/api/modules/{module}/__tests__/{module}.e2e-new.spec.ts

src/app/src/modules/{module}/__tests__/{module}.unit-new.spec.tsx
src/app/src/modules/{module}/__tests__/{module}.integration-new.spec.tsx
src/app/src/modules/{module}/__tests__/{module}.e2e-new.spec.tsx
```

---

## Bug-Finder Methodology

All tests were written using a **bug-finder** approach — prioritizing scenarios most likely to reveal defects:

### 1. Tenant Isolation
Every query tested with explicit `tenantId` scoping. Cross-tenant access asserted to return 403. Entity creation verifies `tenantId` is propagated.

### 2. Input Sanitization
- XSS: `<script>alert(1)</script>` in name/description fields
- SQL injection: `'; DROP TABLE--` patterns in string inputs
- Path traversal: `../../etc/passwd` in file name inputs

### 3. Null / Undefined Handling
Every optional field tested with `null`, `undefined`, and empty string. Hooks tested with `data: undefined` state.

### 4. Boundary Values
- Numeric: negative, zero, max int, NaN, Infinity
- String: empty, whitespace-only, max length + 1
- Arrays: empty, single element, 5000+ elements
- Dates: epoch, far future, invalid ISO string

### 5. Error Path Propagation
- HTTP 400 (validation), 401 (auth), 403 (permission), 404 (not found), 409 (conflict), 500 (server)
- Network timeout / ECONNABORTED
- Prisma transaction rollback on constraint violation
- BullMQ job failure and retry

### 6. Race Conditions
- Concurrent mutation calls on same resource
- Cache invalidation timing (React Query)
- Optimistic update rollback on failure
- Duplicate submission prevention (isPending guard)

### 7. Auth Flows
- Missing JWT → 401
- Expired JWT → token refresh → retry
- Insufficient role → 403
- Multi-tenant JWT with wrong tenantId

---

## Technical Decisions

### API Tests (Jest + @nestjs/testing + supertest)
- **Unit**: Jest with `jest.fn()` mocks, no NestJS bootstrap
- **Integration**: `Test.createTestingModule()` with mock repositories
- **E2E**: Full NestJS app via `supertest` with mocked external deps

### Frontend Tests (Vitest + @testing-library/react)
- **Unit**: `renderHook`, component smoke tests, utility function tests
- **Integration**: React Query `QueryClient` with mock fetch, form submit flows
- **E2E-style**: Full user flows in jsdom, modal open/close, navigation

### Mock Strategy
- All external dependencies (Prisma, Redis, external APIs) use `jest.fn()` / `vi.fn()`
- No real database connections in any test
- BullMQ queues replaced with in-memory mocks

---

## Consequences

### Positive
- **Regression safety net**: 10,125 new tests catch regressions before merge
- **Coverage increase**: Estimated +40% branch coverage across API, +60% for frontend
- **Bug discovery**: Several edge cases identified during test writing (e.g., missing tenantId scoping, unhandled null in hooks)
- **CI enforcement**: Tests run on every PR via existing GitHub Actions pipeline
- **Documentation**: Tests serve as executable specification of expected behavior

### Negative / Trade-offs
- **Maintenance cost**: New tests must be maintained as modules evolve
- **Test duplication risk**: Some scenarios may overlap with existing tests — mitigated by `-new` suffix naming
- **Mock fidelity**: Heavy mocking means some integration bugs may still slip through to staging

---

## Branch

`feat/comprehensive-test-suite` → PR targeting `main`
