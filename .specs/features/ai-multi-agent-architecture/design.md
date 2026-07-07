# Multi-Agent Architecture — Design

## Architecture Overview

```
UserMessage
    │
    ▼
┌──────────────────────────┐
│  ProcessAIResponseService │
│  (orchestrator)           │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│     AgentRouter          │
│  (stateless, pure logic) │
│                          │
│  inputs:                 │
│   - businessType         │
│   - currentPhase         │
│   - lastIntent           │
│                          │
│  output:                 │
│   - AgentDefinition      │
│   - routingReason        │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│   Selected Agent         │
│  (AgentDefinition)       │
│                          │
│  - systemPromptTemplate  │
│  - tools (subset)        │
│  - responseSchema (Zod)  │
│  - phases               │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  ToolCallingChainFactory.create({        │
│    model,                                │
│    tools: agent.tools                    │
│  })                                      │
│  OR                                      │
│  StructuredOutputChainFactory.create({   │
│    schema: agent.responseSchema,         │
│    model,                                │
│    systemPrompt: assembled               │
│  })                                      │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│  ToolExecutionService    │  (if tool_calls present)
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  OutputGuardrailService  │  (universal, always)
└──────────┬───────────────┘
           │
           ▼
       Response
```

## Domain Model

### AgentDefinition (Value Object)

```typescript
// src/api/modules/ai/domain/agents/AgentDefinition.ts

export interface AgentDefinition {
  id: string;                    // 'sales' | 'recovery' | 'scheduling' | 'commerce' | 'support'
  name: string;                  // Human-readable: 'Sales Agent'
  businessTypes: BusinessType[]; // Which niches this agent serves
  intents: string[];             // Which intents trigger this agent
  systemPromptTemplate: string;  // Base prompt (placeholders: {{tenantName}}, {{phaseInstructions}})
  tools: ToolDefinition[];       // Subset of available tools
  responseSchema: z.ZodType;     // Agent-specific response schema
  phases: PhaseDefinition;       // Phase graph for this agent's domain
  defaultPhase: string;          // Initial phase (always GREETING)
}
```

### AgentResponseSchema (base + extensions)

```typescript
// Base — all agents return this
const BaseAgentResponseSchema = z.object({
  reply: z.string().min(1),
  confidence: z.number().min(0).max(1),
  intent: z.enum(['PURCHASE', 'QUESTION', 'COMPLAINT', 'GREETING', 'GENERAL']),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
  phase: z.string().optional(),
  phaseConfidence: z.number().min(0).max(1).optional(),
});

// Recovery extends with negotiation context
const RecoveryResponseSchema = BaseAgentResponseSchema.extend({
  debtAcknowledged: z.boolean().optional(),
  proposedPaymentPlan: z.string().optional(),
  negotiationStatus: z.enum(['OPEN', 'AGREED', 'REJECTED', 'PENDING']).optional(),
});

// Scheduling extends with appointment context
const SchedulingResponseSchema = BaseAgentResponseSchema.extend({
  suggestedDate: z.string().optional(),
  suggestedProfessional: z.string().optional(),
  appointmentConfirmed: z.boolean().optional(),
});

// Commerce extends with order context
const CommerceResponseSchema = BaseAgentResponseSchema.extend({
  orderItems: z.array(z.string()).optional(),
  orderTotal: z.number().optional(),
  deliveryEstimate: z.string().optional(),
});
```

### AgentRegistry (Domain Service)

```typescript
// src/api/modules/ai/domain/agents/AgentRegistry.ts

export class AgentRegistry {
  private static readonly agents: Map<string, AgentDefinition>;

  static getByBusinessType(type: BusinessType): AgentDefinition;
  static getByIntent(intent: string): AgentDefinition | null;
  static getById(id: string): AgentDefinition;
  static getDefault(): AgentDefinition; // SalesAgent
  static getAll(): AgentDefinition[];
}
```

### AgentRouter (Domain Service)

```typescript
// src/api/modules/ai/domain/agents/AgentRouter.ts

export interface AgentRoutingInput {
  businessType: BusinessType;
  currentPhase: string | null;
  lastIntent: string | null;
  tenantOverride?: string; // tenant can force a specific agent
}

export interface AgentRoutingResult {
  agent: AgentDefinition;
  reason: string; // 'intent_override:COMPLAINT' | 'business_type:recovery' | 'default:sales'
}

export class AgentRouter {
  route(input: AgentRoutingInput): AgentRoutingResult;
}
```

## File Structure

```
src/api/modules/ai/domain/agents/
├── AgentDefinition.ts          # Interface + types
├── AgentRegistry.ts            # Static registry with all agent definitions
├── AgentRouter.ts              # Routing logic
├── schemas/
│   ├── BaseAgentResponseSchema.ts
│   ├── RecoveryResponseSchema.ts
│   ├── SchedulingResponseSchema.ts
│   ├── CommerceResponseSchema.ts
│   └── index.ts
├── definitions/
│   ├── SalesAgentDefinition.ts
│   ├── RecoveryAgentDefinition.ts
│   ├── SchedulingAgentDefinition.ts
│   ├── CommerceAgentDefinition.ts
│   ├── SupportAgentDefinition.ts
│   └── index.ts
└── __tests__/
    ├── AgentRegistry.spec.ts
    ├── AgentRouter.spec.ts
    └── AgentSchemas.spec.ts
```

## Routing Decision Table

| businessType | lastIntent    | currentPhase        | Selected Agent  | Reason                    |
|-------------|---------------|---------------------|-----------------|---------------------------|
| any         | COMPLAINT     | any                 | SupportAgent    | intent_override           |
| any         | -             | SUPPORT/COMPLAINT   | SupportAgent    | phase_override            |
| recovery    | -             | any other           | RecoveryAgent   | business_type             |
| clinic      | -             | any other           | SchedulingAgent | business_type             |
| salon       | -             | any other           | SchedulingAgent | business_type             |
| restaurant  | -             | any other           | CommerceAgent   | business_type             |
| ecommerce   | -             | any other           | SalesAgent      | business_type (default)   |
| generic     | -             | any other           | SalesAgent      | default                   |
| law         | -             | any other           | SalesAgent      | business_type (fallback)  |

## System Prompt Template Pattern

Each agent's `systemPromptTemplate` follows this structure:

```
[IDENTIDADE]
Você é {{agentName}}, assistente especializado em {{domain}} para {{tenantName}}.

[OBJETIVO]
{{agentObjective}}

[REGRAS DE COMPORTAMENTO]
{{behaviorRules}}

[FASE ATUAL: {{currentPhase}}]
{{phaseInstructions}}

[FERRAMENTAS DISPONÍVEIS]
{{toolDescriptions}}

[FORMATO DE RESPOSTA]
Responda SEMPRE em JSON válido seguindo o schema:
{{responseSchemaDescription}}
```

Placeholders are resolved at runtime by `AISystemPromptAssembler` before sending to model.

## Integration with Existing Pipeline

`ProcessAIResponseService.runPipeline()` changes:

1. After reading phase state → call `AgentRouter.route()`
2. Use selected agent's prompt template + tools + schema
3. Everything else (guardrails, tool execution, phase transition, persistence) stays the same

This is additive — no existing behavior removed. The router simply provides the right agent config before the AI call.

## Determinism via Structured JSON

- `StructuredOutputChainFactory` already enforces schema validation with retries
- Each agent's schema is a superset of base — always parseable
- If structured output fails after retries, fallback to `SalesAgent` with `BaseAgentResponseSchema`
- Response metadata (`agentId`, `routingReason`) appended to diagnostics for observability
