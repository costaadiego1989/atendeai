# AI LangChain Refactor — Tasks

## Phase 1: Foundation

### T1 — Install LangChain dependencies [P]
- **What:** Add `@langchain/core`, `@langchain/openai`, `zod` to `src/api/package.json`
- **Where:** `src/api/package.json`
- **Depends on:** Nothing
- **Done when:** `npm install` succeeds, imports resolve
- **Tests:** N/A (dependency install)
- **Gate:** `cd src/api && npx tsc --noEmit` passes

### T2 — FakeChatModel test utility [P]
- **What:** Create `FakeChatModel` extending LangChain's `BaseChatModel` for deterministic unit tests. Queues responses, tracks calls.
- **Where:** `src/api/shared/infrastructure/langchain/testing/FakeChatModel.ts`
- **Depends on:** T1
- **Done when:** FakeChatModel can queue text/JSON responses and return them sequentially
- **Tests:** `src/api/shared/infrastructure/langchain/testing/__tests__/FakeChatModel.spec.ts`
- **Gate:** Unit test passes

### T3 — ChatModelFactory [P]
- **What:** Factory that creates `ChatOpenAI` pointing to OpenRouter (`OPENAI_BASE_URL` + `OPENAI_API_KEY`). Separate method for fallback model (same OpenRouter, different model name).
- **Where:** `src/api/shared/infrastructure/langchain/models/ChatModelFactory.ts`
- **Depends on:** T1
- **Done when:** Factory produces configured ChatOpenAI instances
- **Tests:** `src/api/shared/infrastructure/langchain/models/__tests__/ChatModelFactory.spec.ts` — test with FakeChatModel substitute (verify config passed)
- **Gate:** Unit test passes

### T4 — StructuredOutputChain factory
- **What:** Generic factory that takes `ZodSchema + ChatModel` → returns chain using `model.withStructuredOutput(schema)`. Includes retry logic (max 2 attempts on parse failure).
- **Where:** `src/api/shared/infrastructure/langchain/chains/StructuredOutputChainFactory.ts`
- **Depends on:** T2, T3
- **Done when:** Chain invoked with FakeChatModel returns Zod-validated object; retries on malformed output
- **Tests:** `src/api/shared/infrastructure/langchain/chains/__tests__/StructuredOutputChainFactory.spec.ts`
  - Test: valid JSON → returns typed object
  - Test: malformed 1st attempt, valid 2nd → retries and succeeds
  - Test: 2 malformed attempts → throws structured error
- **Gate:** All tests pass

### T5 — TextOutputChain factory [P]
- **What:** Factory that takes `systemPrompt + ChatModel` → returns chain that produces plain string. No schema validation.
- **Where:** `src/api/shared/infrastructure/langchain/chains/TextOutputChainFactory.ts`
- **Depends on:** T2, T3
- **Done when:** Chain returns string content from FakeChatModel
- **Tests:** `src/api/shared/infrastructure/langchain/chains/__tests__/TextOutputChainFactory.spec.ts`
- **Gate:** Unit test passes

### T6 — LangChain NestJS Module
- **What:** `LangChainModule` (NestJS `@Module`) that exports `ChatModelFactory`, `StructuredOutputChainFactory`, `TextOutputChainFactory`. Reads config from `ConfigService`.
- **Where:** `src/api/shared/infrastructure/langchain/langchain.module.ts`
- **Depends on:** T3, T4, T5
- **Done when:** Module compiles, exports resolve
- **Tests:** `src/api/shared/infrastructure/langchain/__tests__/langchain.module.spec.ts` — test module creates
- **Gate:** `cd src/api && npx tsc --noEmit`

### T7 — LangChainAdapter (implements IAIEngine)
- **What:** New adapter replacing `DeepSeekAdapter`. Implements `generateStructuredResponse<T>()`, `generateTextResponse()`, and deprecated `generateResponse()` bridge. Uses `StructuredOutputChainFactory` + `TextOutputChainFactory`.
- **Where:** `src/api/modules/ai/infrastructure/adapters/LangChainAdapter.ts`
- **Depends on:** T4, T5, T6
- **Done when:** All 3 methods work with FakeChatModel in tests
- **Tests:** `src/api/modules/ai/__tests__/LangChainAdapter.spec.ts`
  - Test: generateStructuredResponse with valid schema → returns typed
  - Test: generateStructuredResponse with retry → succeeds on 2nd attempt
  - Test: generateTextResponse → returns string
  - Test: generateResponse (deprecated bridge) → returns AIResponse shape
  - Test: primary fails → fallback model used
- **Gate:** All tests pass

### T8 — Evolve IAIEngine port
- **What:** Add `generateStructuredResponse<T>()` and `generateTextResponse()` to `IAIEngine` interface. Keep `generateResponse()` marked `@deprecated`.
- **Where:** `src/api/modules/ai/application/ports/IAIEngine.ts`
- **Depends on:** T7
- **Done when:** Port has 3 methods, existing code still compiles (deprecated method unchanged)
- **Tests:** Existing tests still pass
- **Gate:** `cd src/api && npx tsc --noEmit && npm test -- --testPathPattern="ai/"` passes

### T9 — Wire LangChainAdapter into ai.module.ts
- **What:** Register `LangChainAdapter` as `AI_ENGINE` provider (replace `DeepSeekAdapter`). Import `LangChainModule`.
- **Where:** `src/api/modules/ai/ai.module.ts`
- **Depends on:** T8
- **Done when:** App compiles with new adapter wired
- **Tests:** Existing E2E tests pass (deprecated bridge maintains backward compat)
- **Gate:** `cd src/api && npm run build && npm test`

---

## Phase 2: Core Migration

### T10 — ConversationClassification Zod schema
- **What:** Define schema for reply + confidence + intent + sentiment (replaces DeepSeek heuristic classification)
- **Where:** `src/api/modules/ai/domain/schemas/ConversationClassificationSchema.ts`
- **Depends on:** T1
- **Done when:** Schema defined and exported
- **Tests:** `src/api/modules/ai/domain/schemas/__tests__/ConversationClassificationSchema.spec.ts` — validates/rejects edge cases
- **Gate:** Unit test passes

### T11 — Migrate ProcessAIResponseService to use generateStructuredResponse
- **What:** Replace `aiEngine.generateResponse()` call with `aiEngine.generateStructuredResponse(ConversationClassificationSchema)`. Remove manual classification/heuristic code.
- **Where:** `src/api/modules/ai/application/services/ProcessAIResponseService.ts`
- **Depends on:** T9, T10
- **Done when:** Pipeline uses structured output, no heuristic classification
- **Tests:** Update existing ProcessAIResponseService tests to use FakeChatModel with structured responses
- **Gate:** `cd src/api && npm test -- --testPathPattern="ProcessAIResponse|ai.e2e"` passes

### T12 — Remove DeepSeekAdapter CLASSIFICATION_SYSTEM_ADDENDUM
- **What:** Clean up legacy code — remove `CLASSIFICATION_SYSTEM_ADDENDUM`, `parseClassifiedResponse()`, `heuristicClassify()` from DeepSeekAdapter (now dead code since LangChainAdapter handles it)
- **Where:** `src/api/modules/ai/infrastructure/adapters/DeepSeekAdapter.ts`
- **Depends on:** T11
- **Done when:** DeepSeekAdapter removed or stripped to minimal (kept only if needed for rollback)
- **Tests:** All existing tests still pass
- **Gate:** `cd src/api && npm test && npm run build`

---

## Phase 3: Consumer Migration

### T13 — RecoveryGuidanceSchema + migrate AIRecoveryGuidanceGenerator [P]
- **What:** Create Zod schema. Migrate to `generateStructuredResponse<RecoveryGuidanceSchema>()`. Remove manual JSON parsing.
- **Where:** `src/api/modules/recovery/domain/schemas/RecoveryGuidanceSchema.ts`, `src/api/modules/recovery/infrastructure/adapters/AIRecoveryGuidanceGenerator.ts`
- **Depends on:** T9
- **Done when:** Service returns Zod-validated output, no regex parsing
- **Tests:** Update `AIRecoveryGuidanceGenerator.spec.ts` with FakeChatModel
- **Gate:** `cd src/api && npm test -- --testPathPattern="recovery"`

### T14 — Migrate AIRecoveryOutreachGenerator [P]
- **What:** Migrate to `generateTextResponse()`. Remove manual error swallowing (let chain handle retry).
- **Where:** `src/api/modules/recovery/infrastructure/adapters/AIRecoveryOutreachGenerator.ts`
- **Depends on:** T9
- **Done when:** Service uses `generateTextResponse()`
- **Tests:** Update `AIRecoveryOutreachGenerator.spec.ts`
- **Gate:** `cd src/api && npm test -- --testPathPattern="recovery"`

### T15 — SaleValidationSchema + migrate ConversationSaleAiValidationService [P]
- **What:** Create Zod schema `{approved, reason, confidence}`. Migrate to `generateStructuredResponse()`. Remove `parseDecision()`.
- **Where:** `src/api/modules/messaging/domain/schemas/SaleValidationSchema.ts`, `src/api/modules/messaging/application/services/ConversationSaleAiValidationService.ts`
- **Depends on:** T9
- **Done when:** No manual JSON parsing, Zod validates output
- **Tests:** Update existing spec
- **Gate:** `cd src/api && npm test -- --testPathPattern="messaging"`

### T16 — PaymentLinkSchema + migrate SuggestPaymentLinkWithAIUseCase [P]
- **What:** Create Zod schema. Migrate to `generateStructuredResponse()`. Remove `parseJsonPayload()` regex.
- **Where:** `src/api/modules/sales/domain/schemas/PaymentLinkSuggestionSchema.ts`, `src/api/modules/sales/application/use-cases/SuggestPaymentLinkWithAIUseCase.ts`
- **Depends on:** T9
- **Done when:** Zod validates payment link output, no regex
- **Tests:** Update existing spec or create new
- **Gate:** `cd src/api && npm test -- --testPathPattern="sales"`

### T17 — Migrate SuggestAgentReplyService [P]
- **What:** Migrate to `generateTextResponse()`. Simplify error handling.
- **Where:** `src/api/modules/messaging/application/services/SuggestAgentReplyService.ts`
- **Depends on:** T9
- **Done when:** Uses `generateTextResponse()`
- **Tests:** Update `SuggestAgentReplyService.spec.ts`
- **Gate:** `cd src/api && npm test -- --testPathPattern="messaging"`

### T18 — Migrate SuggestProspectCampaignMessageUseCase [P]
- **What:** Migrate to `generateTextResponse()`.
- **Where:** `src/api/modules/prospecting/application/use-cases/SuggestProspectCampaignMessageUseCase.ts`
- **Depends on:** T9
- **Done when:** Uses `generateTextResponse()`
- **Tests:** Update/create spec
- **Gate:** `cd src/api && npm test -- --testPathPattern="prospecting"`

### T19 — Migrate AutoReplyEngine [P]
- **What:** Migrate `resolveReplyText()` AI_GENERATED mode to `generateTextResponse()`.
- **Where:** `src/api/modules/social/application/services/AutoReplyEngine.ts`
- **Depends on:** T9
- **Done when:** Uses `generateTextResponse()`
- **Tests:** Update `auto-reply-engine.spec.ts`
- **Gate:** `cd src/api && npm test -- --testPathPattern="social"`

### T20 — Migrate DraftTenantAdminMessageUseCase [P]
- **What:** Migrate to `generateTextResponse()`.
- **Where:** `src/api/modules/platform-admin/application/use-cases/DraftTenantAdminMessageUseCase.ts`
- **Depends on:** T9
- **Done when:** Uses `generateTextResponse()`
- **Tests:** Create unit test with FakeChatModel
- **Gate:** `cd src/api && npm test -- --testPathPattern="platform-admin"`

### T21 — Migrate SuggestVoiceScriptUseCase (fix bypass)
- **What:** Remove direct axios call to Anthropic. Inject `IAIEngine`, use `generateTextResponse()`. Delete axios + AnthropicResponse interface.
- **Where:** `src/api/modules/voice/application/use-cases/SuggestVoiceScriptUseCase.ts`
- **Depends on:** T9
- **Done when:** No direct HTTP to Anthropic, uses IAIEngine port
- **Tests:** Create `SuggestVoiceScriptUseCase.spec.ts` with FakeChatModel
- **Gate:** `cd src/api && npm test -- --testPathPattern="voice"`

---

## Phase 4: Cleanup

### T22 — Remove DeepSeekAdapter
- **What:** Delete `DeepSeekAdapter.ts`. Remove from `ai.module.ts`. Remove `DEEPSEEK_*` env references from code (keep in .env for reference).
- **Where:** `src/api/modules/ai/infrastructure/adapters/DeepSeekAdapter.ts`, `src/api/modules/ai/ai.module.ts`
- **Depends on:** T11, T12, all consumers migrated
- **Done when:** No imports of DeepSeekAdapter remain
- **Tests:** Full test suite passes without it
- **Gate:** `cd src/api && npm run build && npm test`

### T23 — Remove deprecated generateResponse() from IAIEngine
- **What:** Remove `generateResponse()` method from interface. Update all remaining callers.
- **Where:** `src/api/modules/ai/application/ports/IAIEngine.ts`, all consumers
- **Depends on:** T13-T21 all complete
- **Done when:** Port only has `generateStructuredResponse` + `generateTextResponse`
- **Tests:** Full suite passes
- **Gate:** `cd src/api && npm run build && npm test`

---

## Status

| Task | Status | Assignee |
|------|--------|----------|
| T1 | 🔄 IN PROGRESS | subagent-1 |
| T2 | 🔄 IN PROGRESS | subagent-2 |
| T3 | 🔄 IN PROGRESS | subagent-2 |
| T4 | ⏳ WAITING | — |
| T5 | ⏳ WAITING | — |
| T6 | ⏳ WAITING | — |
| T7 | ⏳ WAITING | — |
| T8 | ⏳ WAITING | — |
| T9 | ⏳ WAITING | — |
| T10-T23 | ⏳ WAITING | — |
