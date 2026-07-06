# AI LangChain Refactor — Specification

## Overview

Refatoração completa do sistema de IA do AtendeAi para usar **LangChain.js com JSON Structured Outputs**, substituindo chamadas HTTP diretas (axios → DeepSeek/Anthropic) por chains tipadas, validáveis e com guardrails nativos.

## Motivation

| Problema atual | Impacto |
|---|---|
| Parsing manual de JSON com regex/heurísticas | Falhas silenciosas, classificação incorreta |
| Sem validação de schema na saída | Respostas malformadas passam para o usuário |
| Sem retry/fallback estruturado | Uma falha = erro 500 para tenant |
| Prompts inline como strings | Impossível versionar, testar ou compor |
| Heurística de intent/sentiment como fallback | Classificação imprecisa quando modelo ignora instrução |
| Cada módulo reimplementa pattern de "chamar AI + parsear JSON" | DRY violado massivamente |
| Sem observabilidade de chain (steps, tokens, latency por step) | Debug em produção cego |
| Sem guardrails formais além do safety gate | Modelo pode gerar qualquer formato |

## Goals

- **G1** — Outputs 100% validados por Zod schema antes de chegar ao domínio
- **G2** — Chains compostas e reutilizáveis (prompt → model → parser → validator)
- **G3** — Retry automático com re-prompt quando output inválido
- **G4** — Observabilidade nativa (LangSmith/OpenTelemetry traces por chain)
- **G5** — Fallback multi-provider (DeepSeek → Anthropic → fallback determinístico)
- **G6** — Prompts como templates versionados, testáveis isoladamente
- **G7** — Guardrails: output validation, input sanitization, token budget enforcement
- **G8** — TDD: cada chain testada com mock/scripted LLM antes de integração

## Provider Decision

| Purpose | Env Var | Value | Provider |
|---|---|---|---|
| Chat / Structured Outputs (LangChain) | `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter |
| Chat / Structured Outputs (LangChain) | `OPENAI_API_KEY` | OpenRouter key | OpenRouter |
| Embeddings (RAG) | `OFICIAL_OPENAI_API_KEY` | OpenAI key oficial | OpenAI direta |

- OpenRouter é OpenAI-compatible → `ChatOpenAI` do LangChain funciona sem adapter especial
- Modelo principal via OpenRouter: configurável (ex: `deepseek/deepseek-chat`, `anthropic/claude-haiku-4-5-20251001`)
- Fallback: outro modelo no OpenRouter (sem trocar key/base)
- Embeddings: `text-embedding-3-small` continua na OpenAI oficial (não passa por OpenRouter)

## Non-Goals

- Não alterar lógica de negócio dos módulos consumidores
- Não refazer UI/frontend
- Não migrar knowledge base/RAG nesta fase (fase posterior)

---

## Current State — AI Usage Map

### Core Module: `ai`

| Component | Purpose | Current Pattern | Risk |
|---|---|---|---|
| `DeepSeekAdapter` | LLM provider | axios POST → parse JSON com regex | **HIGH** — centro de tudo |
| `ProcessAIResponseService` | Pipeline de conversa | Orquestra 12 steps em método monolítico | **HIGH** |
| `AISystemPromptAssembler` | Monta system prompt | String concatenation | MEDIUM |
| `AIContextAggregator` | Agrega contextos (commerce, scheduling, PDF) | Multi-provider merge | MEDIUM |
| `AIResponseProcessor` | Pós-processa texto | String manipulation | LOW |
| `HumanHandoffPolicy` | Decide escalation | Threshold check em confidence | LOW |
| `AiSafetyGate` | Input/output safety | Regex patterns | LOW |
| `AIAutomationDispatcher` | Extrai comandos do texto AI | Regex extraction | MEDIUM |
| `NicheClassifier` | Classifica nicho do tenant | Unknown (needs check) | MEDIUM |
| `MediaUnderstandingService` | OCR/transcrição/doc extraction | HTTP adapters | LOW (keep) |
| `OpenAIEmbeddingAdapter` | Embeddings para RAG | axios → OpenAI | LOW (keep for now) |

### Consumer Modules (usam `IAIEngine` via DI)

| Module | Service | Purpose | JSON Output Expected? |
|---|---|---|---|
| `recovery` | `AIRecoveryOutreachGenerator` | Gera 1ª mensagem de cobrança | **Não** — texto puro |
| `recovery` | `AIRecoveryGuidanceGenerator` | Sugere reply + next action | **Sim** — `{suggestedReply, suggestedNextAction}` |
| `prospecting` | `SuggestProspectCampaignMessageUseCase` | Gera mensagem de prospecção | **Não** — texto puro |
| `social` | `AutoReplyEngine` | Auto-reply em comments Instagram | **Não** — texto puro |
| `messaging` | `SuggestAgentReplyService` | Sugere reply para atendente | **Não** — texto puro |
| `messaging` | `ConversationSaleAiValidationService` | Valida se houve venda na conversa | **Sim** — `{approved, reason, confidence}` |
| `sales` | `SuggestPaymentLinkWithAIUseCase` | Gera link de pagamento via prompt | **Sim** — JSON tipado |
| `platform-admin` | `DraftTenantAdminMessageUseCase` | Drafts mensagens admin | **Não** — texto puro |
| `voice` | `SuggestVoiceScriptUseCase` | Gera script de voz | **Não** — texto puro (usa Anthropic direto!) |

### Standalone (não usa IAIEngine)

| Module | Service | Issue |
|---|---|---|
| `voice` | `SuggestVoiceScriptUseCase` | Chama Anthropic API diretamente com axios — **bypass total** da arquitetura |

---

## Requirements

### REQ-01: LangChain Core Infrastructure

Criar camada compartilhada em `src/api/shared/infrastructure/langchain/` com:
- Factory de ChatModel (DeepSeek, Anthropic, com fallback)
- StructuredOutputParser genérico com Zod
- OutputFixingParser para auto-retry
- PromptTemplate registry
- Chain factory (prompt → model → parser)
- Observability middleware (OpenTelemetry + optional LangSmith)
- Token budget guard por tenant

### REQ-02: Refactor IAIEngine Port

Evoluir `IAIEngine` para suportar:
- `generateStructuredResponse<T>(request, schema: ZodSchema<T>): Promise<T>` — output garantido
- `generateTextResponse(request): Promise<string>` — para outputs texto-puro
- Manter `generateResponse()` deprecated durante migração

### REQ-03: New LangChain Adapter

Substituir `DeepSeekAdapter` por `LangChainAdapter` que:
- Usa `ChatDeepSeek` do `@langchain/deepseek` (ou `ChatOpenAI` compatível)
- Usa `withStructuredOutput()` para JSON outputs
- Implementa `OutputFixingParser` como retry layer
- Fallback para `ChatAnthropic` quando DeepSeek falhar
- Emite spans OpenTelemetry por chain execution

### REQ-04: Migrate ProcessAIResponseService

Refatorar pipeline de conversa para usar chain:
- Intent/Sentiment/Confidence como structured output (não mais heurística)
- Cada step = chain link testável isoladamente
- Commerce advance, handoff, automation dispatch mantêm lógica — só input/output fica tipado

### REQ-05: Migrate All Consumers

Cada consumer migra para usar:
- `generateStructuredResponse<T>()` quando espera JSON
- `generateTextResponse()` quando espera texto puro
- Schemas Zod por caso de uso (composable, testável)

### REQ-06: Eliminate Voice Module Bypass

`SuggestVoiceScriptUseCase` deve usar `IAIEngine` (não axios direto para Anthropic).

### REQ-07: Prompt Templates

Extrair todos prompts inline para `PromptTemplate` objects:
- Versionados (path: `src/api/modules/{module}/infrastructure/prompts/`)
- Testáveis (input variables + expected shape)
- Composáveis (base + module-specific + tenant rules)

### REQ-08: Testing Strategy

- Unit: cada chain com `FakeLLM` / scripted responses
- Integration: chain + real Zod parser + fake model
- E2E: chain completa com real provider (tagged `@live`)
- Regression: golden outputs per chain (snapshot tests)

---

## Impacted Files Summary

### Must Change (core)
- `src/api/modules/ai/application/ports/IAIEngine.ts`
- `src/api/modules/ai/infrastructure/adapters/DeepSeekAdapter.ts`
- `src/api/modules/ai/application/services/ProcessAIResponseService.ts`
- `src/api/modules/ai/ai.module.ts`

### Must Change (consumers)
- `src/api/modules/recovery/infrastructure/adapters/AIRecoveryOutreachGenerator.ts`
- `src/api/modules/recovery/infrastructure/adapters/AIRecoveryGuidanceGenerator.ts`
- `src/api/modules/prospecting/application/use-cases/SuggestProspectCampaignMessageUseCase.ts`
- `src/api/modules/social/application/services/AutoReplyEngine.ts`
- `src/api/modules/messaging/application/services/SuggestAgentReplyService.ts`
- `src/api/modules/messaging/application/services/ConversationSaleAiValidationService.ts`
- `src/api/modules/sales/application/use-cases/SuggestPaymentLinkWithAIUseCase.ts`
- `src/api/modules/platform-admin/application/use-cases/DraftTenantAdminMessageUseCase.ts`
- `src/api/modules/voice/application/use-cases/SuggestVoiceScriptUseCase.ts`

### New Files (infrastructure)
- `src/api/shared/infrastructure/langchain/` (factory, parsers, templates, middleware)
- `src/api/modules/*/infrastructure/prompts/` (per-module prompt templates)
- Zod schemas per use case

### Test Files (new)
- Unit tests per chain
- Integration tests per structured output
- Regression golden files

---

## Dependencies to Add

```json
{
  "@langchain/core": "^0.3.x",
  "@langchain/community": "^0.3.x",
  "@langchain/openai": "^0.3.x",
  "langchain": "^0.3.x",
  "zod": "^3.23.x"
}
```

Optional (if provider-specific packages needed):
- `@langchain/anthropic` — for Anthropic fallback
- `@langchain/deepseek` — if dedicated package exists, otherwise use `@langchain/openai` compatible

---

## Migration Strategy

### Phase 1: Foundation (no breaking changes)
1. Install LangChain deps
2. Create shared infrastructure (`langchain/`)
3. Implement new `LangChainAdapter` (implements `IAIEngine`)
4. Add `generateStructuredResponse<T>()` to port
5. Wire new adapter behind feature flag

### Phase 2: Core Migration
6. Migrate `ProcessAIResponseService` pipeline to use chains
7. Remove heuristic classification (replaced by structured output)
8. Remove regex JSON parsing from DeepSeekAdapter

### Phase 3: Consumer Migration (parallelizable)
9. Migrate each consumer one-by-one:
   - Recovery (2 services)
   - Sales (1)
   - Messaging (2)
   - Prospecting (1)
   - Social (1)
   - Platform-Admin (1)
   - Voice (1 — also fix bypass)

### Phase 4: Cleanup
10. Remove deprecated `generateResponse()` from port
11. Remove `DeepSeekAdapter` (replaced by `LangChainAdapter`)
12. Remove all inline prompt strings (now in templates)
13. Remove heuristic classify methods

---

## Acceptance Criteria

- [ ] AC-01: Nenhuma chamada LLM usa axios diretamente
- [ ] AC-02: Todo output JSON passa por Zod schema validation antes de retornar
- [ ] AC-03: Falha de parsing dispara retry automático (até 2x) com re-prompt
- [ ] AC-04: Cada chain tem unit test com FakeLLM
- [ ] AC-05: Voice module usa IAIEngine (não axios para Anthropic)
- [ ] AC-06: OpenTelemetry spans emitidos por chain execution
- [ ] AC-07: Token budget respeitado per-tenant (quota guard integrado à chain)
- [ ] AC-08: Fallback multi-provider funcional (DeepSeek fail → Anthropic)
- [ ] AC-09: Todos os 178+ testes existentes do módulo AI continuam passando
- [ ] AC-10: Prompts extraídos para PromptTemplate (não mais strings inline)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| LangChain overhead (latency) | Response time increase | Benchmark before/after; use streaming se necessário |
| Breaking existing tests | CI red | Feature flag; adapter swap gradual |
| DeepSeek não suporta `function_call` nativo | Structured output falha | Usar prompt-based JSON mode (current approach but via LangChain parser) |
| Zod validation rejects valid-ish outputs | False rejections | OutputFixingParser retries; generous schemas |
| Token cost increase (retry prompts) | Billing impact | Budget guard; max 2 retries; shorter fix prompts |

---

## Traceability

| Requirement | Phase | Priority |
|---|---|---|
| REQ-01 | Phase 1 | P0 (foundation) |
| REQ-02 | Phase 1 | P0 |
| REQ-03 | Phase 1 | P0 |
| REQ-04 | Phase 2 | P0 |
| REQ-05 | Phase 3 | P1 (per-module) |
| REQ-06 | Phase 3 | P1 |
| REQ-07 | Phase 3 | P2 |
| REQ-08 | All phases | P0 (TDD throughout) |
