# Multi-Agent Architecture — Tasks

## Gate Check (every task)
```bash
cd src/api && npx jest --testPathPatterns="domain/agents" --no-coverage --forceExit
```

## Phase 1: Domain Model (no dependencies on existing code)

### T1 — BaseAgentResponseSchema [P]
- **What:** Base Zod schema all agents extend (reply, confidence, intent, sentiment, phase, phaseConfidence)
- **Where:** `src/api/modules/ai/domain/agents/schemas/BaseAgentResponseSchema.ts`
- **Depends on:** Nothing
- **Done when:** Schema validates, rejects invalid, exports type
- **Tests:** `src/api/modules/ai/domain/agents/__tests__/AgentSchemas.spec.ts`
  - Accepts valid base response
  - Rejects missing reply
  - Rejects invalid sentiment
  - phase and phaseConfidence are optional
- **Gate:** Unit tests pass

### T2 — Domain-specific response schemas [P]
- **What:** RecoveryResponseSchema, SchedulingResponseSchema, CommerceResponseSchema (extend base)
- **Where:** `src/api/modules/ai/domain/agents/schemas/` (one file per schema + index.ts)
- **Depends on:** T1
- **Done when:** Each schema extends base with domain fields, validates correctly
- **Tests:** Same test file, additional describe blocks
  - RecoveryResponseSchema accepts negotiationStatus
  - SchedulingResponseSchema accepts suggestedDate
  - CommerceResponseSchema accepts orderItems array
  - All reject invalid base fields
- **Gate:** Unit tests pass

### T3 — AgentDefinition interface [P]
- **What:** TypeScript interface for AgentDefinition (id, name, businessTypes, intents, systemPromptTemplate, tools, responseSchema, phases, defaultPhase)
- **Where:** `src/api/modules/ai/domain/agents/AgentDefinition.ts`
- **Depends on:** Nothing (interface only)
- **Done when:** Exports interface, used by T4-T8
- **Tests:** No runtime tests needed (compile-time contract)
- **Gate:** `npx tsc --noEmit`

### T4 — SalesAgentDefinition [P]
- **What:** Default agent for ecommerce/generic tenants
- **Where:** `src/api/modules/ai/domain/agents/definitions/SalesAgentDefinition.ts`
- **Depends on:** T1, T3
- **Done when:** Exports const conforming to AgentDefinition, includes prompt template + tools + phases
- **Tests:** `src/api/modules/ai/domain/agents/__tests__/AgentDefinitions.spec.ts`
  - Has correct id ('sales')
  - businessTypes includes 'ecommerce', 'generic'
  - tools include 'generate_payment_link', 'trigger_automation'
  - responseSchema is BaseAgentResponseSchema
  - phases matches ecommerce PhaseDefinition
- **Gate:** Unit tests pass

### T5 — RecoveryAgentDefinition [P]
- **What:** Agent for recovery/debt collection tenants
- **Where:** `src/api/modules/ai/domain/agents/definitions/RecoveryAgentDefinition.ts`
- **Depends on:** T1, T2, T3
- **Done when:** Exports const, recovery-specific prompt + tools + schema + phases
- **Tests:** Same test file
  - Has id 'recovery'
  - businessTypes is ['recovery']
  - tools include 'generate_payment_link'
  - responseSchema is RecoveryResponseSchema
  - phases matches recovery PhaseDefinition
- **Gate:** Unit tests pass

### T6 — SchedulingAgentDefinition [P]
- **What:** Agent for clinic/salon tenants
- **Where:** `src/api/modules/ai/domain/agents/definitions/SchedulingAgentDefinition.ts`
- **Depends on:** T1, T2, T3
- **Done when:** Exports const, scheduling-specific prompt + tools + schema + phases
- **Tests:** Same test file
  - Has id 'scheduling'
  - businessTypes is ['clinic', 'salon']
  - tools include 'schedule_slot'
  - responseSchema is SchedulingResponseSchema
- **Gate:** Unit tests pass

### T7 — CommerceAgentDefinition [P]
- **What:** Agent for restaurant/food delivery tenants
- **Where:** `src/api/modules/ai/domain/agents/definitions/CommerceAgentDefinition.ts`
- **Depends on:** T1, T2, T3
- **Done when:** Exports const, commerce-specific prompt + tools + schema + phases
- **Tests:** Same test file
  - Has id 'commerce'
  - businessTypes is ['restaurant']
  - tools include 'repeat_last_order', 'generate_payment_link'
  - responseSchema is CommerceResponseSchema
- **Gate:** Unit tests pass

### T8 — SupportAgentDefinition [P]
- **What:** Agent for support/complaint handling (intent-triggered, any businessType)
- **Where:** `src/api/modules/ai/domain/agents/definitions/SupportAgentDefinition.ts`
- **Depends on:** T1, T3
- **Done when:** Exports const, support-specific prompt + minimal tools + universal phases
- **Tests:** Same test file
  - Has id 'support'
  - businessTypes is empty (intent-triggered)
  - intents include 'COMPLAINT'
  - tools include 'trigger_automation' only
- **Gate:** Unit tests pass

## Phase 2: Registry + Router

### T9 — AgentRegistry
- **What:** Static registry with all agents, lookup by businessType/intent/id
- **Where:** `src/api/modules/ai/domain/agents/AgentRegistry.ts`
- **Depends on:** T4, T5, T6, T7, T8
- **Done when:** All lookup methods work, default fallback returns SalesAgent
- **Tests:** `src/api/modules/ai/domain/agents/__tests__/AgentRegistry.spec.ts`
  - getByBusinessType('recovery') → RecoveryAgent
  - getByBusinessType('clinic') → SchedulingAgent
  - getByBusinessType('salon') → SchedulingAgent
  - getByBusinessType('restaurant') → CommerceAgent
  - getByBusinessType('ecommerce') → SalesAgent
  - getByBusinessType('generic') → SalesAgent
  - getByBusinessType('unknown') → SalesAgent (fallback)
  - getByIntent('COMPLAINT') → SupportAgent
  - getByIntent('PURCHASE') → null (no override)
  - getById('recovery') → RecoveryAgentDefinition
  - getAll() returns 5 agents
- **Gate:** Unit tests pass

### T10 — AgentRouter
- **What:** Deterministic routing logic with priority rules
- **Where:** `src/api/modules/ai/domain/agents/AgentRouter.ts`
- **Depends on:** T9
- **Done when:** route() returns correct agent + reason for all scenarios
- **Tests:** `src/api/modules/ai/domain/agents/__tests__/AgentRouter.spec.ts`
  - intent COMPLAINT + any businessType → SupportAgent (intent_override)
  - phase SUPPORT + recovery businessType → SupportAgent (phase_override)
  - phase DEBT_IDENTIFICATION + recovery → RecoveryAgent (business_type)
  - businessType recovery + no override → RecoveryAgent
  - businessType clinic → SchedulingAgent
  - businessType restaurant → CommerceAgent
  - businessType generic → SalesAgent (default)
  - unknown businessType → SalesAgent (fallback)
  - returns routingReason string
- **Gate:** Unit tests pass

## Phase 3: Pipeline Integration

### T11 — Wire AgentRouter into ProcessAIResponseService
- **What:** After phase state read, call AgentRouter. Use selected agent's schema + prompt template.
- **Where:** `src/api/modules/ai/application/services/ProcessAIResponseService.ts`
- **Depends on:** T10
- **Done when:** Router invoked, agent's schema used for structured output, diagnostics include agentId
- **Tests:** Integration test verifying router is called and agent selection reflected in response
- **Gate:** `npx jest --testPathPatterns="(domain/agents|ProcessAI)" --no-coverage --forceExit`

### T12 — Prompt template resolution
- **What:** AISystemPromptAssembler resolves agent's `systemPromptTemplate` placeholders
- **Where:** `src/api/modules/ai/application/services/AISystemPromptAssembler.ts`
- **Depends on:** T11
- **Done when:** Prompt assembly uses agent template when available, falls back to current behavior
- **Tests:** Unit test verifying template resolution with placeholders
- **Gate:** Module gate

## Status

| Task | Status | Phase |
|------|--------|-------|
| T1 | ⏳ WAITING | 1 - Domain Model |
| T2 | ⏳ WAITING | 1 - Domain Model |
| T3 | ⏳ WAITING | 1 - Domain Model |
| T4 | ⏳ WAITING | 1 - Domain Model |
| T5 | ⏳ WAITING | 1 - Domain Model |
| T6 | ⏳ WAITING | 1 - Domain Model |
| T7 | ⏳ WAITING | 1 - Domain Model |
| T8 | ⏳ WAITING | 1 - Domain Model |
| T9 | ⏳ WAITING | 2 - Registry + Router |
| T10 | ⏳ WAITING | 2 - Registry + Router |
| T11 | ⏳ WAITING | 3 - Pipeline Integration |
| T12 | ⏳ WAITING | 3 - Pipeline Integration |

## Parallelism Map

```
T1 ─┬─→ T2 ─┐
    │        │
T3 ─┼─→ T4 ─┤
    │        ├─→ T9 → T10 → T11 → T12
    ├─→ T5 ─┤
    ├─→ T6 ─┤
    ├─→ T7 ─┤
    └─→ T8 ─┘
```

T1, T3 parallelizable. T4-T8 parallelizable after T1+T3. T9 needs all definitions. T10-T12 sequential.
