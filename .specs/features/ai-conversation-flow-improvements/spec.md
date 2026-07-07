# AI Conversation Flow Improvements

## Classification: Complex
## Modules: ai, messaging, commerce, scheduling
## Approach: TDD-first, validate all module tests at each step

---

## Context

Com a migração para LangChain + Zod (Phase 1-3 completa), temos a fundação para melhorias significativas no fluxo de conversa. Três subsistemas novos trazem determinismo, segurança e inteligência:

1. **Tool Calling** — substituir regex frágeis por function calling nativo
2. **Conversation State Machine** — rastrear fase da conversa com schema validado
3. **Output Guardrails** — validar saída do LLM antes de enviar ao cliente

---

## Requirements

### R1: Tool Calling (substituir AIResponseProcessor regex)

| ID | Requirement |
|----|-------------|
| R1.1 | LLM deve poder invocar ações (PaymentLink, ScheduleSlot, RepeatOrder) via tool_calls nativo do LangChain |
| R1.2 | Cada tool tem schema Zod definindo parâmetros esperados |
| R1.3 | Tool execution handler recebe params tipados, executa ação, retorna resultado |
| R1.4 | Se tool execution falha, LLM recebe feedback e pode reformular resposta |
| R1.5 | AIResponseProcessor (regex-based) é substituído por ToolExecutionService |
| R1.6 | Backward compatible: se modelo não retorna tool_calls, trata como texto puro |
| R1.7 | AutomationDispatcher ([USE_AUTOMATION:uuid]) também migra para tool calling |

### R2: Conversation State Machine

| ID | Requirement |
|----|-------------|
| R2.1 | Cada conversa tem um `ConversationPhase` rastreado: GREETING, QUALIFICATION, PRODUCT_DISCOVERY, QUOTE, CHECKOUT, CONFIRMATION, SUPPORT, COMPLAINT |
| R2.2 | A cada turn, LLM retorna phase atual + confidence como parte do structured output |
| R2.3 | Transições de fase são validadas (não pode pular de GREETING para CHECKOUT) |
| R2.4 | Phase persiste no Redis (via ChatHistoryRepository ou AISession) |
| R2.5 | Handoff policy pode usar phase para decisões mais inteligentes |
| R2.6 | Context assembly (prompt) adapta instruções por phase |
| R2.7 | Widget pode mostrar indicadores de progresso baseado na phase |

### R3: Output Guardrails

| ID | Requirement |
|----|-------------|
| R3.1 | Output do LLM é validado ANTES de enviar ao cliente |
| R3.2 | Validação inclui: sem URLs externas suspeitas, sem PII vazada (CPF, cartão), sem promessas impossíveis |
| R3.3 | Schema `OutputSafetyCheck` com Zod valida cada resposta |
| R3.4 | Se output falha safety check, substitui por mensagem genérica + escalation |
| R3.5 | PII masking: detecta e mascara CPF, email, telefone, cartão no output antes de persistir |
| R3.6 | Hallucination check básico: se output cita preço/horário, verificar contra dados reais do tenant (fase posterior) |
| R3.7 | Toxic content detection: regex + classificação básica no output |

---

## Schemas Novos (Zod)

### ConversationResponseSchema (evolução do ConversationClassificationSchema)
```typescript
const ConversationResponseSchema = z.object({
  reply: z.string().min(1),
  confidence: z.number().min(0).max(1),
  intent: z.enum(['PURCHASE', 'QUESTION', 'COMPLAINT', 'GREETING', 'GENERAL']),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
  phase: z.enum([
    'GREETING', 'QUALIFICATION', 'PRODUCT_DISCOVERY',
    'QUOTE', 'CHECKOUT', 'CONFIRMATION', 'SUPPORT', 'COMPLAINT'
  ]),
  phaseConfidence: z.number().min(0).max(1),
  shouldEscalate: z.boolean(),
  escalationReason: z.string().optional(),
  toolCalls: z.array(z.object({
    tool: z.enum(['payment_link', 'schedule_slot', 'repeat_order', 'trigger_automation']),
    params: z.record(z.unknown()),
  })).optional(),
});
```

### OutputSafetySchema
```typescript
const OutputSafetySchema = z.object({
  hasPII: z.boolean(),
  hasExternalUrls: z.boolean(),
  hasPriceClaimm: z.boolean(),
  toxicityScore: z.number().min(0).max(1),
  safe: z.boolean(),
  violations: z.array(z.string()),
});
```

---

## Non-Goals

- Não migrar RAG/embeddings nesta fase
- Não alterar frontend do widget (apenas API contract)
- Não implementar hallucination checking completo (só flag básico)
- Não mexer em commerce/scheduling domain logic — só na interface de invocação

---

## Acceptance Criteria

1. [ ] `[PAYMENT_LINK:...]` regex removida — PaymentLinkTool via tool_calls
2. [ ] `[SCHEDULE_SLOT:...]` regex removida — ScheduleSlotTool via tool_calls
3. [ ] `[REPEAT_LAST_ORDER]` regex removida — RepeatOrderTool via tool_calls
4. [ ] `[USE_AUTOMATION:uuid]` regex removida — TriggerAutomationTool
5. [ ] ConversationPhase rastreado e persistido a cada turn
6. [ ] Phase transition validation implementada
7. [ ] Output safety check roda antes de persistir/enviar
8. [ ] PII masking ativo no output
9. [ ] Todos unit tests dos módulos ai, messaging, recovery passam
10. [ ] E2E conversation flow test com tool calling funciona
11. [ ] AIResponseProcessor.ts pode ser removido (dead code)
12. [ ] Nenhum regex de action tag resta no pipeline

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM não retorna tool_calls corretamente | HIGH | Fallback para texto puro (R1.6) + retry |
| State machine adiciona latência | MEDIUM | Phase é campo no schema existente, não call separada |
| Output guardrails bloqueiam respostas legítimas | MEDIUM | Score threshold + log antes de bloquear |
| OpenRouter nem sempre suporta function calling | HIGH | Testar com modelo específico, configurar modelo que suporta |

---

## Implementation Phases

### Phase A: Tool Calling (elimina regex)
Highest ROI. Remove fragilidade do regex. LangChain tool calling nativo.

### Phase B: Output Guardrails  
Safety layer. PII masking + content validation.

### Phase C: Conversation State Machine
Adds intelligence. Phase tracking + adaptive prompting.

---

## Dependencies

- ✅ LangChain infrastructure (Phase 1 complete)
- ✅ IAIEngine port with generateStructuredResponse (complete)
- ✅ FakeChatModel supports tool_calls (complete)
- 🔲 Modelo no OpenRouter que suporte function calling (verificar)
- 🔲 Redis para state persistence (já disponível via REDIS_CLIENT)
