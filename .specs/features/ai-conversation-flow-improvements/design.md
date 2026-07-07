# AI Conversation Flow Improvements — Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ProcessAIResponseService                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Safety Gate (input)                                           │
│ 2. Quota Check                                                   │
│ 3. Session + History                                             │
│ 4. Context Assembly (phase-aware prompting)                      │
│ 5. AI Call → ConversationResponseSchema (reply+phase+tools)      │
│ 6. Output Guardrails ← NEW                                      │
│ 7. Tool Execution ← NEW (replaces AIResponseProcessor regex)    │
│ 8. Phase Transition Validation ← NEW                            │
│ 9. Handoff Policy (phase-aware)                                  │
│ 10. Persist (turn + phase + tool results)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase A: Tool Calling

### Concept

Em vez de instruir o LLM a emitir tags como `[PAYMENT_LINK:Produto,99.90]` (que precisam de regex), definimos **tools** que o LLM pode chamar nativamente via function calling do OpenAI/OpenRouter.

LangChain suporta isso via `model.bindTools(tools)` — o modelo retorna `tool_calls` no response, que são objetos tipados.

### Tool Definitions

```typescript
// src/api/modules/ai/domain/tools/PaymentLinkTool.ts
import { z } from 'zod';
import { tool } from '@langchain/core/tools';

export const PaymentLinkToolSchema = z.object({
  productName: z.string().describe('Nome do produto ou serviço'),
  value: z.number().positive().describe('Valor em reais (ex: 99.90)'),
});

export const paymentLinkTool = tool(
  async (input) => {
    // execution handled by ToolExecutionService, not here
    return JSON.stringify(input);
  },
  {
    name: 'generate_payment_link',
    description: 'Gera um link de pagamento para o cliente. Use quando o cliente confirmar que quer pagar.',
    schema: PaymentLinkToolSchema,
  }
);
```

```typescript
// src/api/modules/ai/domain/tools/ScheduleSlotTool.ts
export const ScheduleSlotToolSchema = z.object({
  professionalId: z.string().optional().describe('ID do profissional'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Data YYYY-MM-DD'),
  slotId: z.string().optional().describe('ID do slot específico'),
  categoryId: z.string().optional().describe('ID da categoria/serviço'),
  payment: z.enum(['required', 'not_required']).default('not_required'),
});
```

```typescript
// src/api/modules/ai/domain/tools/RepeatOrderTool.ts
export const RepeatOrderToolSchema = z.object({
  confirm: z.boolean().describe('true quando cliente confirma que quer repetir'),
});
```

```typescript
// src/api/modules/ai/domain/tools/TriggerAutomationTool.ts
export const TriggerAutomationToolSchema = z.object({
  automationId: z.string().uuid().describe('ID da automação a disparar'),
});
```

### ToolExecutionService

```typescript
// src/api/modules/ai/application/services/ToolExecutionService.ts
@Injectable()
export class ToolExecutionService {
  constructor(
    private readonly paymentLinkGenerator: IPaymentLinkGenerator,
    private readonly reserveSlot: IReserveProfessionalSlot,
    private readonly repeatOrder: IRepeatLastOrder,
    private readonly automationFacade: IManualAutomationFacade,
  ) {}

  async execute(toolCall: ToolCallResult, context: ConversationContext): Promise<ToolExecutionResult> {
    switch (toolCall.name) {
      case 'generate_payment_link':
        return this.executePaymentLink(toolCall.args, context);
      case 'schedule_slot':
        return this.executeScheduleSlot(toolCall.args, context);
      case 'repeat_last_order':
        return this.executeRepeatOrder(context);
      case 'trigger_automation':
        return this.executeTriggerAutomation(toolCall.args, context);
      default:
        return { success: false, error: `Unknown tool: ${toolCall.name}` };
    }
  }
}
```

### ToolCallingChainFactory (nova)

```typescript
// src/api/shared/infrastructure/langchain/chains/ToolCallingChainFactory.ts
@Injectable()
export class ToolCallingChainFactory {
  create(opts: {
    model: BaseChatModel;
    tools: StructuredTool[];
    responseSchema: z.ZodType; // for the text part
    systemPrompt: string;
  }): ToolCallingChain {
    const boundModel = opts.model.bindTools(opts.tools);
    // Returns: { textResponse: z.infer<schema>, toolCalls: ToolCall[] }
  }
}
```

### Migration Path

1. Definir tool schemas
2. Criar ToolExecutionService (reutiliza lógica do AIResponseProcessor)
3. Criar ToolCallingChainFactory
4. Migrar ProcessAIResponseService: step 8 usa model com tools bound
5. Se response tem tool_calls → executar → incorporar resultado na reply
6. Remover AIResponseProcessor + AIAutomationDispatcher regex

---

## Phase B: Output Guardrails

### OutputGuardrailService

```typescript
// src/api/modules/ai/application/services/OutputGuardrailService.ts
@Injectable()
export class OutputGuardrailService {
  evaluate(output: string, context: GuardrailContext): OutputSafetyResult {
    return {
      safe: !this.hasPII(output) && !this.hasSuspiciousUrls(output) && !this.isToxic(output),
      violations: [...],
      sanitized: this.maskPII(output),
    };
  }

  private hasPII(text: string): boolean {
    // CPF: \d{3}\.\d{3}\.\d{3}-\d{2}
    // Cartão: \d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}
    // Email no output (não no contexto de contato)
  }

  private maskPII(text: string): string {
    // CPF → ***.***.***-**
    // Cartão → ****-****-****-1234
  }

  private hasSuspiciousUrls(text: string): boolean {
    // URLs que não são do domínio do tenant
  }

  private isToxic(text: string): boolean {
    // Palavrões, conteúdo ofensivo — blocklist
  }
}
```

### Integration Point

No `ProcessAIResponseService`, entre step 8 (AI call) e step 9 (handoff):

```typescript
// Step 8.5: Output guardrails
const safety = this.outputGuardrail.evaluate(response.text, { tenantId });
if (!safety.safe) {
  response.text = safety.sanitized || 'Desculpe, não consigo responder isso agora.';
  // Log violation
}
```

---

## Phase C: Conversation State Machine

### ConversationPhase Enum

```typescript
export const CONVERSATION_PHASES = [
  'GREETING',           // Primeira interação, boas-vindas
  'QUALIFICATION',      // Entendendo o que o cliente precisa
  'PRODUCT_DISCOVERY',  // Mostrando produtos/serviços
  'QUOTE',              // Apresentando valores
  'CHECKOUT',           // Processo de pagamento
  'CONFIRMATION',       // Confirmação de compra/agendamento
  'SUPPORT',            // Suporte pós-venda
  'COMPLAINT',          // Reclamação ativa
] as const;

export type ConversationPhase = typeof CONVERSATION_PHASES[number];
```

### Phase Transition Rules

```typescript
const VALID_TRANSITIONS: Record<ConversationPhase, ConversationPhase[]> = {
  GREETING: ['QUALIFICATION', 'PRODUCT_DISCOVERY', 'SUPPORT', 'COMPLAINT'],
  QUALIFICATION: ['PRODUCT_DISCOVERY', 'QUOTE', 'SUPPORT', 'COMPLAINT'],
  PRODUCT_DISCOVERY: ['QUOTE', 'CHECKOUT', 'QUALIFICATION', 'COMPLAINT'],
  QUOTE: ['CHECKOUT', 'PRODUCT_DISCOVERY', 'QUALIFICATION', 'COMPLAINT'],
  CHECKOUT: ['CONFIRMATION', 'QUOTE', 'COMPLAINT'],
  CONFIRMATION: ['SUPPORT', 'GREETING'],  // new conversation cycle
  SUPPORT: ['GREETING', 'COMPLAINT', 'QUALIFICATION'],
  COMPLAINT: ['SUPPORT', 'QUALIFICATION'],  // can only de-escalate
};
```

### PhaseTracker Service

```typescript
@Injectable()
export class ConversationPhaseTracker {
  constructor(private readonly redis: Redis) {}

  async getCurrentPhase(conversationId: string): Promise<ConversationPhase> { ... }
  async transition(conversationId: string, newPhase: ConversationPhase): Promise<boolean> { ... }
  async getPhaseHistory(conversationId: string): Promise<PhaseTransition[]> { ... }
}
```

### Impact on Prompt Assembly

`AISystemPromptAssembler` adiciona instruções específicas por phase:

```typescript
const PHASE_INSTRUCTIONS: Record<ConversationPhase, string> = {
  GREETING: 'Cumprimente o cliente. Pergunte como pode ajudar.',
  QUALIFICATION: 'Faça perguntas para entender a necessidade.',
  PRODUCT_DISCOVERY: 'Apresente opções relevantes do catálogo.',
  QUOTE: 'Apresente valores e condições.',
  CHECKOUT: 'Guie o pagamento. Use generate_payment_link quando confirmar.',
  CONFIRMATION: 'Confirme detalhes e agradeça.',
  SUPPORT: 'Ajude com dúvidas pós-compra.',
  COMPLAINT: 'Ouça com empatia. Escale se necessário.',
};
```

---

## File Structure

```
src/api/
├── modules/ai/
│   ├── domain/
│   │   ├── schemas/
│   │   │   ├── ConversationResponseSchema.ts  (evolução)
│   │   │   └── OutputSafetySchema.ts
│   │   ├── tools/
│   │   │   ├── PaymentLinkTool.ts
│   │   │   ├── ScheduleSlotTool.ts
│   │   │   ├── RepeatOrderTool.ts
│   │   │   ├── TriggerAutomationTool.ts
│   │   │   └── index.ts
│   │   └── value-objects/
│   │       ├── ConversationPhase.ts
│   │       └── PhaseTransitionRules.ts
│   ├── application/services/
│   │   ├── ToolExecutionService.ts
│   │   ├── OutputGuardrailService.ts
│   │   ├── ConversationPhaseTracker.ts
│   │   └── ProcessAIResponseService.ts (modified)
│   └── infrastructure/persistence/
│       └── RedisConversationPhaseStore.ts
├── shared/infrastructure/langchain/
│   └── chains/
│       └── ToolCallingChainFactory.ts
```

---

## Testing Strategy

### Unit Tests (TDD-first)
- Each tool schema: validates params, rejects invalid
- ToolExecutionService: each tool type → success + failure paths
- OutputGuardrailService: PII detection, URL detection, masking
- ConversationPhaseTracker: transitions valid/invalid
- ToolCallingChainFactory: FakeChatModel with tool_calls

### Integration Tests
- Full pipeline with tool calling → action executed
- Phase persists across turns
- Output guardrail blocks PII leak

### Module Test Gate (run at each step)
```bash
cd src/api && npx jest --testPathPatterns="ai/" --no-coverage --forceExit
```

---

## Observability

- Each tool execution traced via `traceAsync`
- Phase transitions logged with `DomainTrace`
- Output guardrail violations emit `AIOutputBlockedIntegrationEvent`
- Metrics: tool_calls_per_conversation, phase_distribution, guardrail_block_rate
