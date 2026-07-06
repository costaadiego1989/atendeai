# AI LangChain Refactor — Design Document

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Consumer Modules                          │
│  recovery │ prospecting │ social │ messaging │ sales │ voice    │
└─────────────┬───────────────────────────────────────────────────┘
              │ uses port (DI token)
              ▼
┌─────────────────────────────────────────────────────────────────┐
│              IAIEngine (application port)                        │
│  generateStructuredResponse<T>(req, ZodSchema<T>): Promise<T>   │
│  generateTextResponse(req): Promise<string>                     │
│  generateResponse(req): Promise<AIResponse> [DEPRECATED]        │
└─────────────┬───────────────────────────────────────────────────┘
              │ implemented by
              ▼
┌─────────────────────────────────────────────────────────────────┐
│              LangChainAdapter (infrastructure)                   │
│                                                                 │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────────────┐     │
│  │ ChatModel │→  │ PromptTemplate│→  │ StructuredOutputParser│   │
│  │ (DeepSeek │   │ (per use case)│   │ (Zod schema)         │   │
│  │  primary) │   └──────────────┘   └─────────────────────┘     │
│  │           │                              │                   │
│  │ ChatModel │   ┌──────────────────────────┘                   │
│  │ (Anthropic│   │ OutputFixingParser (retry)                   │
│  │  fallback)│   └──────────────────────────────────────────┐   │
│  └──────────┘                                               │   │
│                    ┌────────────────────────┐                │   │
│                    │ TokenBudgetGuard       │                │   │
│                    │ ObservabilityMiddleware│                │   │
│                    │ FallbackChain          │                │   │
│                    └────────────────────────┘                │   │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│              LLM Providers (external)                            │
│  DeepSeek API  │  Anthropic API  │  (future: others)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Shared Infrastructure: `src/api/shared/infrastructure/langchain/`

### Directory Structure

```
src/api/shared/infrastructure/langchain/
├── index.ts                          # barrel exports
├── models/
│   ├── ChatModelFactory.ts           # creates ChatDeepSeek / ChatAnthropic
│   └── FallbackModelChain.ts         # primary → fallback orchestration
├── parsers/
│   ├── ZodStructuredOutputParser.ts  # generic parser using Zod
│   └── OutputFixingParser.ts         # retry with re-prompt on parse failure
├── templates/
│   ├── PromptTemplateRegistry.ts     # loads/caches templates
│   └── BasePromptTemplates.ts        # shared template fragments
├── middleware/
│   ├── ObservabilityMiddleware.ts    # OpenTelemetry span per chain step
│   └── TokenBudgetMiddleware.ts      # enforces per-tenant token limits
├── chains/
│   ├── StructuredChainFactory.ts     # builds prompt→model→parser chain
│   └── TextChainFactory.ts           # builds prompt→model→string chain  
├── testing/
│   ├── FakeChatModel.ts              # deterministic responses for unit tests
│   └── ChainTestHarness.ts           # helper to test chains in isolation
└── langchain.module.ts               # NestJS module exporting factories
```

### ChatModelFactory

**Provider Decision (2026-07-06):**
- **Chat/Structured outputs:** OpenRouter via `OPENAI_BASE_URL` + `OPENAI_API_KEY`
- **Embeddings:** OpenAI oficial via `OFICIAL_OPENAI_API_KEY` (hardcoded baseURL `https://api.openai.com/v1`)
- OpenRouter é OpenAI-compatible, então `ChatOpenAI` do LangChain funciona direto

```typescript
// Pseudo-code — final implementation via TDD
import { ChatOpenAI } from '@langchain/openai';

export class ChatModelFactory {
  createPrimary(config: ModelConfig): BaseChatModel {
    // OpenRouter via OPENAI_BASE_URL + OPENAI_API_KEY
    return new ChatOpenAI({
      modelName: config.model ?? 'deepseek/deepseek-chat',
      openAIApiKey: config.apiKey,           // OPENAI_API_KEY (OpenRouter key)
      configuration: { baseURL: config.baseUrl }, // OPENAI_BASE_URL
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1000,
      timeout: config.timeoutMs ?? 120_000,
    });
  }

  createFallback(config: ModelConfig): BaseChatModel {
    // Same OpenRouter, different model
    return new ChatOpenAI({
      modelName: config.fallbackModel ?? 'anthropic/claude-haiku-4-5-20251001',
      openAIApiKey: config.apiKey,
      configuration: { baseURL: config.baseUrl },
      maxTokens: config.maxTokens ?? 1000,
    });
  }
}
```

### StructuredChainFactory

```typescript
import { z } from 'zod';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';

export class StructuredChainFactory {
  create<T extends z.ZodType>(opts: {
    schema: T;
    promptTemplate: PromptTemplate;
    model: BaseChatModel;
    maxRetries?: number;
  }): RunnableSequence {
    const parser = StructuredOutputParser.fromZodSchema(opts.schema);
    
    // Format instructions injected into prompt
    const chainPrompt = opts.promptTemplate.partial({
      format_instructions: parser.getFormatInstructions(),
    });

    return RunnableSequence.from([
      chainPrompt,
      opts.model,
      parser,  // validates + retries on failure
    ]);
  }
}
```

---

## Evolved IAIEngine Port

```typescript
// src/api/modules/ai/application/ports/IAIEngine.ts
import { z } from 'zod';

export interface StructuredAIRequest<T extends z.ZodType> {
  schema: T;
  promptTemplate: string;  // template name from registry
  variables: Record<string, unknown>;
  contextHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  trace?: AITraceContext;
}

export interface TextAIRequest {
  systemPrompt: string;
  userMessage: string;
  contextHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  trace?: AITraceContext;
}

export interface IAIEngine {
  /** Structured output — validated by Zod schema, auto-retry on parse failure */
  generateStructuredResponse<T extends z.ZodType>(
    request: StructuredAIRequest<T>,
  ): Promise<z.infer<T>>;

  /** Text output — for free-form text generation */
  generateTextResponse(request: TextAIRequest): Promise<string>;

  /** @deprecated Use generateStructuredResponse or generateTextResponse */
  generateResponse(request: AIRequest): Promise<AIResponse>;
}
```

---

## Per-Module Schemas (examples)

### Recovery Guidance Schema

```typescript
// src/api/modules/recovery/domain/schemas/RecoveryGuidanceSchema.ts
import { z } from 'zod';

export const RecoveryGuidanceSchema = z.object({
  suggestedReply: z.string().min(10).max(500)
    .describe('Mensagem curta, educada e persuasiva para enviar ao devedor via WhatsApp'),
  suggestedNextAction: z.string().min(5).max(200)
    .describe('Próximo passo operacional para o agente de cobrança'),
});

export type RecoveryGuidanceOutput = z.infer<typeof RecoveryGuidanceSchema>;
```

### Sales Payment Link Schema

```typescript
// src/api/modules/sales/domain/schemas/PaymentLinkSuggestionSchema.ts
import { z } from 'zod';

export const PaymentLinkSuggestionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  label: z.string().max(100).optional(),
  value: z.number().positive(),
  billingType: z.enum(['PIX', 'CREDIT_CARD', 'BOLETO', 'UNDEFINED']),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export type PaymentLinkSuggestion = z.infer<typeof PaymentLinkSuggestionSchema>;
```

### Conversation Classification Schema (replaces DeepSeek heuristics)

```typescript
// src/api/modules/ai/domain/schemas/ConversationClassificationSchema.ts
import { z } from 'zod';

export const ConversationClassificationSchema = z.object({
  reply: z.string().min(1)
    .describe('Resposta ao cliente em português brasileiro'),
  confidence: z.number().min(0).max(1)
    .describe('Confiança do modelo na resposta (0.0 a 1.0)'),
  intent: z.enum(['PURCHASE', 'QUESTION', 'COMPLAINT', 'GREETING', 'GENERAL'])
    .describe('Intenção detectada na mensagem do usuário'),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE'])
    .describe('Sentimento detectado na mensagem do usuário'),
});

export type ConversationClassification = z.infer<typeof ConversationClassificationSchema>;
```

### Sale Validation Schema

```typescript
// src/api/modules/messaging/domain/schemas/SaleValidationSchema.ts
import { z } from 'zod';

export const SaleValidationSchema = z.object({
  approved: z.boolean()
    .describe('true se há evidência clara de venda concretizada'),
  reason: z.string().min(5).max(500)
    .describe('Justificativa curta em português'),
  confidence: z.number().min(0).max(1),
});

export type SaleValidationResult = z.infer<typeof SaleValidationSchema>;
```

---

## LangChainAdapter Implementation Pattern

```typescript
// src/api/modules/ai/infrastructure/adapters/LangChainAdapter.ts
@Injectable()
export class LangChainAdapter implements IAIEngine {
  constructor(
    private readonly modelFactory: ChatModelFactory,
    private readonly chainFactory: StructuredChainFactory,
    private readonly textChainFactory: TextChainFactory,
    private readonly templateRegistry: PromptTemplateRegistry,
    private readonly budgetGuard: TokenBudgetMiddleware,
    private readonly configService: ConfigService,
  ) {}

  async generateStructuredResponse<T extends z.ZodType>(
    request: StructuredAIRequest<T>,
  ): Promise<z.infer<T>> {
    const model = this.modelFactory.createPrimary(this.getConfig());
    const template = this.templateRegistry.get(request.promptTemplate);

    const chain = this.chainFactory.create({
      schema: request.schema,
      promptTemplate: template,
      model,
      maxRetries: 2,
    });

    try {
      return await chain.invoke(request.variables);
    } catch (primaryError) {
      // Fallback to Anthropic
      const fallbackModel = this.modelFactory.createFallback(this.getFallbackConfig());
      const fallbackChain = this.chainFactory.create({
        schema: request.schema,
        promptTemplate: template,
        model: fallbackModel,
        maxRetries: 1,
      });
      return await fallbackChain.invoke(request.variables);
    }
  }

  async generateTextResponse(request: TextAIRequest): Promise<string> {
    const model = this.modelFactory.createPrimary(this.getConfig());
    const chain = this.textChainFactory.create({ model });
    
    const result = await chain.invoke({
      systemPrompt: request.systemPrompt,
      userMessage: request.userMessage,
      contextHistory: request.contextHistory ?? [],
    });

    return result.content as string;
  }

  /** @deprecated — bridge for gradual migration */
  async generateResponse(request: AIRequest): Promise<AIResponse> {
    // Delegates to generateStructuredResponse with ConversationClassificationSchema
    // Maintains backward compatibility during migration
  }
}
```

---

## Testing Architecture

### FakeChatModel (for unit tests)

```typescript
// src/api/shared/infrastructure/langchain/testing/FakeChatModel.ts
export class FakeChatModel extends BaseChatModel {
  private responses: string[] = [];
  private callIndex = 0;

  queueResponse(json: object): void {
    this.responses.push(JSON.stringify(json));
  }

  queueText(text: string): void {
    this.responses.push(text);
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const response = this.responses[this.callIndex++] ?? '{}';
    return {
      generations: [{ message: new AIMessage(response), text: response }],
    };
  }
}
```

### Test Pattern (TDD — red → green → refactor)

```typescript
describe('RecoveryGuidanceChain', () => {
  it('should return validated RecoveryGuidanceOutput', async () => {
    // Arrange
    const fakeLLM = new FakeChatModel();
    fakeLLM.queueResponse({
      suggestedReply: 'Oi João, vi uma pendência...',
      suggestedNextAction: 'Enviar link de pagamento',
    });

    const chain = chainFactory.create({
      schema: RecoveryGuidanceSchema,
      promptTemplate: recoveryGuidanceTemplate,
      model: fakeLLM,
    });

    // Act
    const result = await chain.invoke({ debtorName: 'João', amount: '150.00' });

    // Assert
    expect(result.suggestedReply).toContain('João');
    expect(result.suggestedNextAction).toBeDefined();
    // Zod already validated — if we got here, schema passed
  });

  it('should retry on malformed output', async () => {
    const fakeLLM = new FakeChatModel();
    fakeLLM.queueResponse({ bad: 'format' }); // 1st attempt fails
    fakeLLM.queueResponse({                   // retry succeeds
      suggestedReply: 'Oi Maria...',
      suggestedNextAction: 'Agendar follow-up',
    });

    const chain = chainFactory.create({
      schema: RecoveryGuidanceSchema,
      promptTemplate: recoveryGuidanceTemplate,
      model: fakeLLM,
      maxRetries: 2,
    });

    const result = await chain.invoke({ debtorName: 'Maria', amount: '200.00' });
    expect(result.suggestedReply).toContain('Maria');
  });
});
```

---

## Observability Design

```typescript
// Each chain execution emits:
span: 'langchain.chain.invoke' {
  'ai.chain.name': 'recovery_guidance',
  'ai.provider': 'deepseek',
  'ai.model': 'deepseek-chat',
  'tenant.id': '...',
  'ai.tokens.input': 340,
  'ai.tokens.output': 120,
  'ai.retries': 0,
  'ai.parse.success': true,
  'ai.latency_ms': 2340,
  'ai.fallback.used': false,
}
```

---

## Module Boundary Rules

1. **LangChain infra lives in `shared/infrastructure/langchain/`** — never in domain
2. **Zod schemas live in `modules/{module}/domain/schemas/`** — they ARE domain contracts
3. **PromptTemplates live in `modules/{module}/infrastructure/prompts/`** — infrastructure concern
4. **IAIEngine port stays in `modules/ai/application/ports/`** — consumers never import LangChain directly
5. **FakeChatModel lives in `shared/infrastructure/langchain/testing/`** — available to all test suites

---

## Migration Compatibility

During migration, both paths coexist:

```typescript
// ai.module.ts providers during transition
{
  provide: AI_ENGINE,
  useClass: process.env.AI_USE_LANGCHAIN === 'true'
    ? LangChainAdapter
    : DeepSeekAdapter,  // legacy
}
```

This allows:
- Feature-flag controlled rollout
- A/B testing latency/quality
- Instant rollback if issues
- Per-tenant gradual migration

---

## Implementation Order (TDD-first)

| # | What | Test first | Implements |
|---|---|---|---|
| 1 | `FakeChatModel` | N/A (test util) | REQ-08 |
| 2 | `ZodStructuredOutputParser` | Parser validates/rejects | REQ-01 |
| 3 | `OutputFixingParser` | Retries on failure | REQ-01 |
| 4 | `ChatModelFactory` | Creates correct model type | REQ-01 |
| 5 | `StructuredChainFactory` | Chain produces typed output | REQ-01 |
| 6 | `TextChainFactory` | Chain produces string | REQ-01 |
| 7 | `LangChainAdapter` (structured) | Adapter delegates to chain | REQ-03 |
| 8 | `LangChainAdapter` (text) | Adapter delegates to text chain | REQ-03 |
| 9 | `LangChainAdapter` (fallback) | Primary fail → fallback succeeds | REQ-03 |
| 10 | IAIEngine port evolution | Backward compat maintained | REQ-02 |
| 11 | `ConversationClassificationSchema` + chain | Replaces heuristic | REQ-04 |
| 12 | `ProcessAIResponseService` migration | Pipeline uses chains | REQ-04 |
| 13-21 | Consumer migrations (one per service) | Each has its own test | REQ-05, REQ-06 |
| 22 | Prompt template extraction | Templates load correctly | REQ-07 |
| 23 | Cleanup deprecated code | No legacy imports remain | Phase 4 |
