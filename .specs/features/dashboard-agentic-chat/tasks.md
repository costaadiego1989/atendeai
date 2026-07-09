# Tasks: Dashboard Agentic Chat

## Phase 1: Foundation (Backend Core)

### T-001: Install LangGraph + Create Module Structure [P]
**What:** Add `@langchain/langgraph` dependency and create the dashboard-agent domain structure within AI module.
**Where:** `package.json`, `src/api/modules/ai/domain/dashboard-agent/`
**Depends on:** Nothing
**Done when:** `@langchain/langgraph` installed, folder structure created, module compiles
**Tests:** TypeScript compiles with no errors
**Gate:** `cd src/api && npx tsc --noEmit`

### T-002: Define Metrics Provider Ports [P]
**What:** Create interfaces for all 6 metrics providers (ports no AI module).
**Where:** `src/api/modules/ai/application/ports/dashboard/`
**Depends on:** Nothing
**Reuses:** Existing port pattern from `IAIEngine.ts`
**Done when:** 6 interfaces defined with clear method signatures
**Tests:** TypeScript compiles
**Gate:** `cd src/api && npx tsc --noEmit`

### T-003: DashboardToolRegistry — Niche→Tools Mapping
**What:** Create registry that maps businessType to available tool IDs. Configurable, not hardcoded logic.
**Where:** `src/api/modules/ai/domain/dashboard-agent/DashboardToolRegistry.ts`
**Depends on:** T-002
**Reuses:** Pattern from `AgentRegistry.ts`
**Done when:** Registry returns correct tool set per niche, covers all 25 niches from NicheClassifier
**Tests:** Unit test — each niche returns expected tools array
**Gate:** `npx jest DashboardToolRegistry`

### T-004: DashboardAgentFactory — LangGraph Agent Builder
**What:** Factory that creates `createReactAgent` instance with tenant context, LLM config, and selected tools.
**Where:** `src/api/modules/ai/domain/dashboard-agent/DashboardAgentFactory.ts`
**Depends on:** T-001, T-003
**Reuses:** `ChatModelFactory` pattern for LLM instantiation
**Done when:** Factory produces a callable agent with streaming support
**Tests:** Unit test with mock LLM — agent invokes tools and returns response
**Gate:** `npx jest DashboardAgentFactory`

### T-005: System Prompt Builder (Niche-Aware)
**What:** Build dynamic system prompt incorporating tenant business data, niche-specific instructions, and available tools description.
**Where:** `src/api/modules/ai/domain/dashboard-agent/DashboardPromptBuilder.ts`
**Depends on:** T-002
**Reuses:** `PromptBuilder` pattern from existing AI module
**Done when:** Produces pt-BR prompt with tenant context, tool usage instructions, isolation rules
**Tests:** Unit test — prompt contains expected sections per niche
**Gate:** `npx jest DashboardPromptBuilder`

---

## Phase 2: Tools Implementation [P — all tools parallel]

### T-006: SalesMetricsTool + DashboardMetricsAdapter
**What:** Tool that queries revenue/sales data. Adapter uses Prisma to aggregate from sales tables.
**Where:** 
- `src/api/modules/ai/domain/dashboard-agent/tools/SalesMetricsTool.ts`
- `src/api/modules/ai/infrastructure/adapters/DashboardMetricsAdapter.ts`
**Depends on:** T-002
**Reuses:** Prisma patterns from existing repositories
**Done when:** Tool returns revenue, ticket médio, count by period. Always scoped by tenantId.
**Tests:** 
- Unit: tool with mock provider returns structured JSON
- Integration: adapter queries real DB with test tenant
**Gate:** `npx jest SalesMetricsTool DashboardMetricsAdapter`

### T-007: AttendanceStatusTool + AttendanceMetricsAdapter
**What:** Tool that queries real-time attendance/messaging metrics.
**Where:**
- `src/api/modules/ai/domain/dashboard-agent/tools/AttendanceStatusTool.ts`
- `src/api/modules/ai/infrastructure/adapters/AttendanceMetricsAdapter.ts`
**Depends on:** T-002
**Done when:** Returns active conversations, queue size, avg response time, by channel
**Tests:** Unit + integration
**Gate:** `npx jest AttendanceStatusTool AttendanceMetricsAdapter`

### T-008: SchedulingTool + SchedulingMetricsAdapter
**What:** Tool for scheduling-niche tenants — agenda, occupancy, cancellations.
**Where:**
- `src/api/modules/ai/domain/dashboard-agent/tools/SchedulingTool.ts`
- `src/api/modules/ai/infrastructure/adapters/SchedulingMetricsAdapter.ts`
**Depends on:** T-002
**Done when:** Returns daily/weekly schedule occupancy, available slots, no-shows
**Tests:** Unit + integration
**Gate:** `npx jest SchedulingTool SchedulingMetricsAdapter`

### T-009: CatalogInventoryTool + CatalogMetricsAdapter
**What:** Tool for commerce-niche tenants — products, stock, orders.
**Where:**
- `src/api/modules/ai/domain/dashboard-agent/tools/CatalogInventoryTool.ts`
- `src/api/modules/ai/infrastructure/adapters/CatalogMetricsAdapter.ts`
**Depends on:** T-002
**Done when:** Returns top products, low-stock items, pending orders, avg order value
**Tests:** Unit + integration
**Gate:** `npx jest CatalogInventoryTool CatalogMetricsAdapter`

### T-010: RecoveryStatusTool + RecoveryMetricsAdapter
**What:** Tool for recovery metrics — open debts, recovered amount, conversion rate.
**Where:**
- `src/api/modules/ai/domain/dashboard-agent/tools/RecoveryStatusTool.ts`
- `src/api/modules/ai/infrastructure/adapters/RecoveryMetricsAdapter.ts`
**Depends on:** T-002
**Done when:** Returns open vs recovered, conversion rate, top debtors, scheduled collections
**Tests:** Unit + integration
**Gate:** `npx jest RecoveryStatusTool RecoveryMetricsAdapter`

### T-011: ContactsCRMTool + ContactMetricsAdapter
**What:** Tool for CRM data — contacts, funnel, engagement, search.
**Where:**
- `src/api/modules/ai/domain/dashboard-agent/tools/ContactsCRMTool.ts`
- `src/api/modules/ai/infrastructure/adapters/ContactMetricsAdapter.ts`
**Depends on:** T-002
**Done when:** Returns total contacts, new in period, funnel distribution, search by name/phone
**Tests:** Unit + integration
**Gate:** `npx jest ContactsCRMTool ContactMetricsAdapter`

---

## Phase 3: Use Case + Controller

### T-012: StreamDashboardChatUseCase
**What:** Orchestrates: load tenant → get tools → create agent → stream response → persist history.
**Where:** `src/api/modules/ai/application/use-cases/StreamDashboardChatUseCase.ts`
**Depends on:** T-003, T-004, T-005
**Reuses:** Use case pattern from `ProcessAIResponseUseCase`
**Done when:** Returns Observable<MessageEvent> with SSE-compatible stream. Handles errors gracefully.
**Tests:** Unit test with mocked agent — verifies tenant context loading, tool selection, stream emission
**Gate:** `npx jest StreamDashboardChatUseCase`

### T-013: GetDashboardChatHistoryUseCase
**What:** Retrieves conversation history for a given thread.
**Where:** `src/api/modules/ai/application/use-cases/GetDashboardChatHistoryUseCase.ts`
**Depends on:** Nothing (just Prisma query)
**Done when:** Returns last N messages for threadId, scoped by tenantId
**Tests:** Unit test
**Gate:** `npx jest GetDashboardChatHistoryUseCase`

### T-014: DashboardChatController (SSE + REST)
**What:** NestJS controller with:
- `GET /ai/dashboard/:tenantId/chat/stream?message=X&threadId=Y` (SSE)
- `GET /ai/dashboard/:tenantId/chat/history?threadId=Y` (REST)
- `POST /ai/dashboard/:tenantId/chat` (non-streaming alternative)
**Where:** `src/api/modules/ai/presentation/controllers/DashboardChatController.ts`
**Depends on:** T-012, T-013
**Reuses:** Controller patterns from existing `AIController`
**Done when:** Endpoints respond correctly with guards (JwtCookie + Tenant)
**Tests:** E2E test with supertest — verifies auth, tenant isolation, SSE stream
**Gate:** `npx jest DashboardChatController`

### T-015: Rate Limiting Middleware
**What:** Per-tenant rate limiting (per-minute + daily) for dashboard chat.
**Where:** `src/api/modules/ai/infrastructure/guards/DashboardChatRateLimitGuard.ts`
**Depends on:** T-014
**Reuses:** Redis-based rate limiting pattern
**Done when:** Returns 429 when limits exceeded, friendly message in response body
**Tests:** Unit test — exceeds limit, gets rejected
**Gate:** `npx jest DashboardChatRateLimitGuard`

---

## Phase 4: Persistence + Memory

### T-016: Prisma Schema — Dashboard Chat History
**What:** Add table for storing dashboard chat messages (tenantId, userId, threadId, role, content, toolCalls, createdAt).
**Where:** `src/api/prisma/schema.prisma`, migration
**Depends on:** Nothing
**Done when:** Migration created and applied, Prisma client generated
**Tests:** `npx prisma generate` succeeds
**Gate:** `npx prisma migrate dev`

### T-017: PrismaDashboardChatRepository
**What:** Repository for persisting/retrieving chat messages.
**Where:** `src/api/modules/ai/infrastructure/persistence/PrismaDashboardChatRepository.ts`
**Depends on:** T-016
**Done when:** CRUD operations for chat messages, scoped by tenantId
**Tests:** Integration test with test DB
**Gate:** `npx jest PrismaDashboardChatRepository`

---

## Phase 5: Frontend

### T-018: Dashboard Chat Service (SSE Client)
**What:** Service that connects to SSE endpoint, handles streaming tokens, connection management.
**Where:** `src/app/src/modules/dashboard/services/dashboard-chat-service.ts`
**Depends on:** T-014 (backend endpoint exists)
**Done when:** Connects to SSE, emits token events, handles reconnection/errors
**Tests:** Unit test with mock EventSource
**Gate:** Frontend compiles

### T-019: useDashboardChatViewModel
**What:** View model managing chat state: messages, input, loading, streaming, tool indicators.
**Where:** `src/app/src/modules/dashboard/view-models/useDashboardChatViewModel.ts`
**Depends on:** T-018
**Reuses:** View model pattern from `useChannelsSettingsViewModel`
**Done when:** Manages conversation state, sends messages, appends streaming tokens
**Tests:** Unit test
**Gate:** Frontend compiles

### T-020: DashboardChatWidget (UI)
**What:** Floating chat widget — button + expandable panel with messages, input, suggestions.
**Where:** `src/app/src/modules/dashboard/components/DashboardChat/`
**Depends on:** T-019
**Done when:** 
- Floating button (canto inferior direito)
- Expandable panel with messages
- Streaming text animation
- Tool call indicators ("Consultando vendas...")
- Niche-based suggestion chips
- Responsive (mobile + desktop)
**Tests:** Component renders, displays messages, shows suggestions
**Gate:** Frontend compiles + visual check

### T-021: Integrate Widget into DashboardPage
**What:** Mount DashboardChatWidget in the main dashboard page.
**Where:** `src/app/src/modules/dashboard/views/DashboardPage.tsx`
**Depends on:** T-020
**Done when:** Widget visible on dashboard, functional end-to-end
**Tests:** E2E visual test
**Gate:** App compiles and renders

---

## Phase 6: Module Registration + Wiring

### T-022: Register Dashboard Agent in AI Module
**What:** Wire all providers, adapters, use cases, controller in `ai.module.ts`.
**Where:** `src/api/modules/ai/ai.module.ts`
**Depends on:** T-014, T-015, T-017 (all backend tasks)
**Done when:** Module compiles, DI resolves all dependencies
**Tests:** `cd src/api && npx tsc --noEmit && npm run build`
**Gate:** Build succeeds

---

## Execution Order (Critical Path)

```
T-001 ─┬─ T-002 ──┬── T-003 ── T-004 ──┐
       │          │                      │
       │          ├── T-005 ─────────────┤
       │          │                      │
       │          ├── T-006 [P] ─────────┤
       │          ├── T-007 [P] ─────────┤
       │          ├── T-008 [P] ─────────┤
       │          ├── T-009 [P] ─────────┤
       │          ├── T-010 [P] ─────────┤
       │          └── T-011 [P] ─────────┤
       │                                 │
       └── T-016 ── T-017 ──────────────┤
                                         │
                                         ▼
                              T-012 ── T-013 ── T-014 ── T-015
                                                  │
                                                  ▼
                              T-018 ── T-019 ── T-020 ── T-021
                                                  │
                                                  ▼
                                               T-022
```

[P] = Can run in parallel

---

## Summary

| Phase | Tasks | Parallelism | Estimated Effort |
|-------|-------|-------------|------------------|
| 1. Foundation | T-001 to T-005 | T-001∥T-002, then T-003∥T-005 | Medium |
| 2. Tools | T-006 to T-011 | All 6 parallel | Large (most code) |
| 3. Use Case + API | T-012 to T-015 | Sequential | Medium |
| 4. Persistence | T-016 to T-017 | Sequential | Small |
| 5. Frontend | T-018 to T-021 | Sequential | Medium |
| 6. Wiring | T-022 | Single | Small |
