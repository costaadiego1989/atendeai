# AI Conversation Flow Improvements — Tasks

## Gate Check (every task)
```bash
cd src/api && npx jest --testPathPatterns="ai/" --no-coverage --forceExit
```

---

## Phase A: Tool Calling

### TA1 — Tool Schemas (Zod) [P]
- **What:** Define 4 tool schemas: PaymentLinkToolSchema, ScheduleSlotToolSchema, RepeatOrderToolSchema, TriggerAutomationToolSchema
- **Where:** `src/api/modules/ai/domain/tools/`
- **Depends on:** Nothing
- **Done when:** Schemas export, validate valid/invalid params
- **Tests:** `src/api/modules/ai/domain/tools/__tests__/tool-schemas.spec.ts`
  - Each schema: accepts valid input
  - Each schema: rejects missing required fields
  - Each schema: rejects invalid types
- **Gate:** Unit tests pass

### TA2 — ToolExecutionService [P]
- **What:** Service that takes a tool call (name + args + context) and executes the corresponding action. Replaces AIResponseProcessor regex logic.
- **Where:** `src/api/modules/ai/application/services/ToolExecutionService.ts`
- **Depends on:** TA1, existing IPaymentLinkGenerator, IReserveProfessionalSlot, IRepeatLastOrder, IManualAutomationFacade
- **Done when:** Executes all 4 tool types with success + failure handling
- **Tests:** `src/api/modules/ai/__tests__/ToolExecutionService.spec.ts`
  - generate_payment_link → calls IPaymentLinkGenerator, returns URL
  - schedule_slot → calls IReserveProfessionalSlot, returns confirmation
  - repeat_last_order → calls IRepeatLastOrder, returns cart summary
  - trigger_automation → calls IManualAutomationFacade
  - Unknown tool → returns error result
  - Tool execution failure → graceful error with fallback text
- **Gate:** Unit tests pass

### TA3 — ToolCallingChainFactory
- **What:** LangChain chain factory that binds tools to model and returns structured response + tool_calls
- **Where:** `src/api/shared/infrastructure/langchain/chains/ToolCallingChainFactory.ts`
- **Depends on:** TA1, FakeChatModel (supports bindTools)
- **Done when:** Chain returns { textResponse, toolCalls[] } with typed params
- **Tests:** `src/api/shared/infrastructure/langchain/chains/__tests__/ToolCallingChainFactory.spec.ts`
  - Model returns tool_call → chain returns typed toolCall
  - Model returns text only (no tools) → chain returns empty toolCalls[]
  - Model returns multiple tool_calls → all returned
  - Invalid tool_call args → caught and reported
- **Gate:** Unit tests pass

### TA4 — FakeChatModel: multi-tool support
- **What:** Extend FakeChatModel to support returning multiple tool_calls in single response + text alongside tools
- **Where:** `src/api/shared/infrastructure/langchain/testing/FakeChatModel.ts`
- **Depends on:** Nothing
- **Done when:** Can queue response with tool_calls + text content simultaneously
- **Tests:** `src/api/shared/infrastructure/langchain/testing/__tests__/FakeChatModel.spec.ts` (extend existing)
  - queueToolCall(name, args) → returns AIMessageChunk with tool_calls
  - queueResponseWithTools(text, toolCalls[]) → returns both
- **Gate:** Existing + new tests pass

### TA5 — Integrate tool calling into ProcessAIResponseService
- **What:** Replace Step 10 (AIResponseProcessor.process) with ToolExecutionService. Model bound with tools. Response parsed for tool_calls.
- **Where:** `src/api/modules/ai/application/services/ProcessAIResponseService.ts`
- **Depends on:** TA2, TA3
- **Done when:** Pipeline uses tool_calls instead of regex. AIResponseProcessor no longer called.
- **Tests:** Update ProcessAIResponseService tests to verify:
  - Response with tool_call → tool executed → result incorporated
  - Response without tool_call → text returned as-is
  - Tool execution failure → fallback message sent
- **Gate:** `npx jest --testPathPatterns="(ai/|messaging)" --no-coverage --forceExit`

### TA6 — Remove AIResponseProcessor
- **What:** Delete AIResponseProcessor.ts. Remove from ai.module.ts. Remove all regex action tag parsing.
- **Where:** `src/api/modules/ai/application/services/AIResponseProcessor.ts`, `ai.module.ts`
- **Depends on:** TA5 (all tests pass without it)
- **Done when:** File deleted, no imports remain, all tests pass
- **Tests:** Full module gate
- **Gate:** `npx jest --testPathPatterns="ai/" --no-coverage --forceExit`

### TA7 — Remove AIAutomationDispatcher regex
- **What:** AIAutomationDispatcher no longer parses `[USE_AUTOMATION:uuid]` regex. TriggerAutomationTool handles this.
- **Where:** `src/api/modules/ai/application/services/AIAutomationDispatcher.ts`
- **Depends on:** TA5
- **Done when:** No regex in the file, uses ToolExecutionService result
- **Tests:** Update existing tests
- **Gate:** Module gate

---

## Phase B: Output Guardrails

### TB1 — PII Detection Utils [P]
- **What:** Utility functions: detectCPF, detectCreditCard, detectEmail, detectPhone in output text
- **Where:** `src/api/modules/ai/domain/services/PIIDetector.ts`
- **Depends on:** Nothing
- **Tests:** `src/api/modules/ai/__tests__/PIIDetector.spec.ts`
  - CPF patterns (xxx.xxx.xxx-xx, xxxxxxxxxxx)
  - Credit card (4 groups of 4)
  - Email in middle of text
  - Phone (various BR formats)
  - No false positives on normal text
  - No false positives on tenant business data (CNPJ is OK)
- **Gate:** Unit tests pass

### TB2 — PII Masking [P]
- **What:** maskPII(text): replaces detected PII with masked versions
- **Where:** `src/api/modules/ai/domain/services/PIIMasker.ts`
- **Depends on:** TB1
- **Tests:** `src/api/modules/ai/__tests__/PIIMasker.spec.ts`
  - CPF → ***.***.***-XX (last 2 visible)
  - Card → ****-****-****-1234
  - Email → j***@g***.com
  - Phone → (XX) XXXXX-1234
  - Text without PII → unchanged
- **Gate:** Unit tests pass

### TB3 — OutputGuardrailService
- **What:** Service that evaluates AI output safety: PII, external URLs, toxic content
- **Where:** `src/api/modules/ai/application/services/OutputGuardrailService.ts`
- **Depends on:** TB1, TB2
- **Done when:** evaluate() returns { safe, violations[], sanitized }
- **Tests:** `src/api/modules/ai/__tests__/OutputGuardrailService.spec.ts`
  - Clean output → safe: true
  - Output with CPF → safe: false, sanitized has masked PII
  - Output with external URL → violation flagged
  - Output with toxic word → violation flagged
  - Multiple violations → all reported
- **Gate:** Unit tests pass

### TB4 — Integrate guardrails into pipeline
- **What:** Add OutputGuardrailService between AI call and persistence in ProcessAIResponseService
- **Where:** `src/api/modules/ai/application/services/ProcessAIResponseService.ts`
- **Depends on:** TB3
- **Done when:** Output is sanitized before sending. Violations logged.
- **Tests:** Integration test verifying PII is masked in persisted message
- **Gate:** Module gate

---

## Phase C: Conversation State Machine

### TC1 — ConversationPhase value object [P]
- **What:** Enum + validation + transition rules
- **Where:** `src/api/modules/ai/domain/value-objects/ConversationPhase.ts`
- **Depends on:** Nothing
- **Tests:** `src/api/modules/ai/__tests__/ConversationPhase.spec.ts`
  - All phases defined
  - isValidTransition: GREETING → QUALIFICATION = true
  - isValidTransition: GREETING → CHECKOUT = false
  - isValidTransition: COMPLAINT → SUPPORT = true
- **Gate:** Unit tests pass

### TC2 — ConversationPhaseTracker (Redis)
- **What:** Persist/retrieve current phase per conversation in Redis
- **Where:** `src/api/modules/ai/infrastructure/persistence/RedisConversationPhaseStore.ts`
- **Depends on:** TC1
- **Done when:** get/set/transition methods work with Redis
- **Tests:** `src/api/modules/ai/__tests__/ConversationPhaseTracker.spec.ts`
  - New conversation → defaults to GREETING
  - Valid transition → updates and returns true
  - Invalid transition → returns false, keeps old phase
  - History tracked (last N transitions)
- **Gate:** Unit tests pass (mock Redis)

### TC3 — Evolve ConversationResponseSchema with phase
- **What:** Add `phase` and `phaseConfidence` to ConversationClassificationSchema
- **Where:** `src/api/modules/ai/domain/schemas/ConversationClassificationSchema.ts`
- **Depends on:** TC1
- **Done when:** Schema includes phase field, existing tests still pass
- **Tests:** Update schema tests
- **Gate:** Module gate

### TC4 — Phase-aware prompt assembly
- **What:** AISystemPromptAssembler adds phase-specific instructions
- **Where:** `src/api/modules/ai/application/services/AISystemPromptAssembler.ts`
- **Depends on:** TC2, TC3
- **Done when:** Prompt includes phase context and instructions
- **Tests:** Verify prompt content changes by phase
- **Gate:** Module gate

### TC5 — Integrate phase tracking into pipeline
- **What:** ProcessAIResponseService reads current phase before AI call, validates transition after, persists new phase
- **Where:** `src/api/modules/ai/application/services/ProcessAIResponseService.ts`
- **Depends on:** TC2, TC3, TC4
- **Done when:** Phase persists across turns, invalid transitions rejected
- **Tests:** Integration test: multi-turn conversation advances phases correctly
- **Gate:** Full module gate

---

## Status

| Task | Status | Phase |
|------|--------|-------|
| TA1 | ⏳ WAITING | A - Tool Calling |
| TA2 | ⏳ WAITING | A - Tool Calling |
| TA3 | ⏳ WAITING | A - Tool Calling |
| TA4 | ⏳ WAITING | A - Tool Calling |
| TA5 | ⏳ WAITING | A - Tool Calling |
| TA6 | ⏳ WAITING | A - Tool Calling |
| TA7 | ⏳ WAITING | A - Tool Calling |
| TB1 | ⏳ WAITING | B - Output Guardrails |
| TB2 | ⏳ WAITING | B - Output Guardrails |
| TB3 | ⏳ WAITING | B - Output Guardrails |
| TB4 | ⏳ WAITING | B - Output Guardrails |
| TC1 | ⏳ WAITING | C - State Machine |
| TC2 | ⏳ WAITING | C - State Machine |
| TC3 | ⏳ WAITING | C - State Machine |
| TC4 | ⏳ WAITING | C - State Machine |
| TC5 | ⏳ WAITING | C - State Machine |

---

## Parallelism Map

```
TA1 ─┬─→ TA2 ─┐
     │         ├─→ TA5 → TA6 → TA7
TA4 ─┼─→ TA3 ─┘
     │
TB1 ─→ TB2 → TB3 → TB4
     │
TC1 ─┬─→ TC2 ─┐
     └─→ TC3 ──┼─→ TC4 → TC5
               │
```

Phases A, B, C são independentes entre si nos primeiros tasks.
TA1, TB1, TC1, TA4 podem rodar em paralelo.
