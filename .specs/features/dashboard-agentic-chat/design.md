# Design: Dashboard Agentic Chat

## Architecture Decision Record (ADR)

### Status: Proposed
### Date: 2026-07-08
### Context

AtendeAi já possui um módulo AI robusto com multi-agent architecture (5 agentes por nicho), LangChain integration via OpenRouter, structured output com Zod, e tool calling. Porém esse pipeline é focado em **responder clientes** (WhatsApp/Instagram). O dashboard não tem nenhum backend próprio — os dados são montados client-side.

Precisamos de um **agente conversacional para o dashboard** que responda perguntas do operador/dono sobre seu negócio: métricas, finanças, atendimentos, estoque, agendamentos. Diferente do agente de atendimento (que fala COM o cliente), esse agente fala COM o dono SOBRE o negócio.

### Decision

**Usar LangGraph `createReactAgent`** como orquestrador, com tools tenant-scoped que consultam dados dos módulos existentes via facades/ports. Streaming via SSE.

**Razões:**
1. LangGraph oferece loop ReAct nativo (sem reimplementar)
2. `createReactAgent` lida com multi-tool orchestration automaticamente
3. Streaming built-in com `agent.stream()`
4. Checkpointer para memória de conversa
5. OpenRouter já é nosso provider — mesmo padrão do AI module existente

### Alternatives Considered

| Alternativa | Prós | Contras | Decisão |
|---|---|---|---|
| Extender ProcessAIResponseService | Reutiliza pipeline | Acoplado demais ao fluxo de mensageria, não suporta streaming, tools diferentes | ❌ Rejeitado |
| LangChain AgentExecutor | Familiar | Deprecated em favor do LangGraph, sem streaming nativo | ❌ Rejeitado |
| Custom ReAct loop | Controle total | Reimplementar wheel, bugs, manutenção | ❌ Rejeitado |
| LangGraph createReactAgent | Nativo, streaming, checkpointer, tools | Nova dependência (@langchain/langgraph) | ✅ Escolhido |

---

## Module Architecture

```
src/api/modules/ai/
├── domain/
│   └── dashboard-agent/
│       ├── DashboardAgentFactory.ts        # Cria agent por tenant context
│       ├── DashboardToolRegistry.ts        # Registry nicho→tools
│       └── tools/
│           ├── SalesMetricsTool.ts          # REQ-003
│           ├── AttendanceStatusTool.ts      # REQ-004
│           ├── SchedulingTool.ts            # REQ-005
│           ├── CatalogInventoryTool.ts      # REQ-006
│           ├── RecoveryStatusTool.ts        # REQ-007
│           └── ContactsCRMTool.ts           # REQ-008
├── application/
│   ├── ports/
│   │   ├── IDashboardAgentService.ts       # Port para o serviço
│   │   ├── IDashboardMetricsProvider.ts    # Port para dados de vendas
│   │   ├── IAttendanceMetricsProvider.ts   # Port para dados de atendimento
│   │   ├── ISchedulingMetricsProvider.ts   # Port para dados de agenda
│   │   ├── ICatalogMetricsProvider.ts      # Port para dados de catálogo
│   │   ├── IRecoveryMetricsProvider.ts     # Port para dados de recovery
│   │   └── IContactMetricsProvider.ts      # Port para dados de contatos
│   ├── services/
│   │   └── DashboardAgentService.ts        # Orquestra criação + invocação
│   └── use-cases/
│       ├── StreamDashboardChatUseCase.ts    # SSE streaming endpoint
│       └── GetDashboardChatHistoryUseCase.ts
├── infrastructure/
│   ├── adapters/
│   │   ├── DashboardMetricsAdapter.ts      # Impl via Prisma/Sales module
│   │   ├── AttendanceMetricsAdapter.ts     # Impl via Messaging module
│   │   ├── SchedulingMetricsAdapter.ts     # Impl via Scheduling module
│   │   ├── CatalogMetricsAdapter.ts        # Impl via Commerce/Catalog module
│   │   ├── RecoveryMetricsAdapter.ts       # Impl via Recovery module
│   │   └── ContactMetricsAdapter.ts        # Impl via Contact module
│   ├── persistence/
│   │   └── PrismaDashboardChatRepository.ts # Histórico de conversas
│   └── langraph/
│       └── DashboardAgentGraph.ts          # LangGraph setup + checkpointer
├── presentation/
│   └── controllers/
│       └── DashboardChatController.ts      # SSE + REST endpoints
```

---

## Component Design

### 1. DashboardAgentFactory

Cria instância do `createReactAgent` configurada para o tenant:

```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';

export class DashboardAgentFactory {
  create(tenantContext: DashboardTenantContext, tools: StructuredTool[]) {
    const llm = new ChatOpenAI({
      model: this.configService.get('OPENROUTER_DASHBOARD_MODEL', 'anthropic/claude-sonnet-4'),
      apiKey: this.configService.get('OPENROUTER_API_KEY'),
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
      streaming: true,
    });

    return createReactAgent({
      llm,
      tools,
      stateModifier: this.buildSystemPrompt(tenantContext),
    });
  }
}
```

### 2. DashboardToolRegistry

Mapeia nicho → tools disponíveis:

```typescript
export class DashboardToolRegistry {
  private nicheToolMap: Record<string, string[]> = {
    ECOMMERCE: ['sales_metrics', 'attendance_status', 'catalog_inventory', 'recovery_status', 'contacts_crm'],
    CLINIC: ['sales_metrics', 'attendance_status', 'scheduling', 'contacts_crm'],
    FOOD: ['sales_metrics', 'attendance_status', 'catalog_inventory', 'contacts_crm'],
    // ... per REQ-009 matrix
  };

  getToolsForNiche(businessType: string): StructuredTool[] {
    const toolIds = this.nicheToolMap[businessType] || this.nicheToolMap['GENERIC'];
    return toolIds.map(id => this.toolInstances.get(id)).filter(Boolean);
  }
}
```

### 3. Tool Pattern (exemplo: SalesMetricsTool)

```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export function createSalesMetricsTool(metricsProvider: IDashboardMetricsProvider) {
  return tool(
    async ({ period, groupBy }, runConfig) => {
      const tenantId = runConfig.configurable?.tenantId;
      const data = await metricsProvider.getRevenue(tenantId, period, groupBy);
      return JSON.stringify(data);
    },
    {
      name: 'sales_metrics',
      description: 'Consulta métricas de vendas/receita do negócio. Use para responder sobre faturamento, ticket médio, vendas por período, comparativos.',
      schema: z.object({
        period: z.enum(['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'last_30_days']),
        groupBy: z.enum(['day', 'week', 'month', 'product', 'seller']).optional(),
      }),
    }
  );
}
```

### 4. Streaming Controller (SSE)

```typescript
@Controller('ai/dashboard')
export class DashboardChatController {
  @Sse(':tenantId/chat/stream')
  @UseGuards(JwtCookieGuard, TenantGuard)
  streamChat(
    @Param('tenantId') tenantId: string,
    @Query('message') message: string,
    @Query('threadId') threadId: string,
    @Req() req: AuthenticatedRequest,
  ): Observable<MessageEvent> {
    return this.streamDashboardChatUseCase.execute({
      tenantId,
      userId: req.user.sub,
      message,
      threadId,
    });
  }
}
```

### 5. Tenant Context Builder

Reutiliza `AIContextAggregator` existente + dados do tenant:

```typescript
interface DashboardTenantContext {
  tenantId: string;
  companyName: string;
  businessType: string;
  services: string;
  operatingHours: any;
  description: string;
  address: string;
  language: string;
}
```

---

## Data Flow

```
Frontend Chat Widget
    │ POST /ai/dashboard/:tenantId/chat/stream?message=X&threadId=Y
    ▼
DashboardChatController (SSE)
    │
    ▼
StreamDashboardChatUseCase
    │ 1. Load tenant context
    │ 2. Get tools for niche
    │ 3. Build/retrieve agent
    ▼
DashboardAgentFactory.create(context, tools)
    │
    ▼
LangGraph createReactAgent
    │ Loop: LLM decides → call tool OR respond
    │
    ├── Tool call → SalesMetricsTool → Prisma query (scoped) → JSON
    ├── Tool call → AttendanceTool → Messaging facade → JSON  
    ├── Tool call → SchedulingTool → Scheduling facade → JSON
    │
    ▼
Stream tokens via SSE → Frontend renders progressively
```

---

## Cross-Module Communication

Tools NÃO importam diretamente de outros módulos. Usam **ports** definidos no AI module, com adapters injetados via DI:

| Tool | Port (AI module) | Adapter (infra) | Data Source |
|------|-------------------|-----------------|-------------|
| SalesMetrics | IDashboardMetricsProvider | DashboardMetricsAdapter | Prisma: sales, billing tables |
| Attendance | IAttendanceMetricsProvider | AttendanceMetricsAdapter | Prisma: messaging tables + Redis |
| Scheduling | ISchedulingMetricsProvider | SchedulingMetricsAdapter | Prisma: scheduling tables |
| CatalogInventory | ICatalogMetricsProvider | CatalogMetricsAdapter | Prisma: catalog, inventory tables |
| Recovery | IRecoveryMetricsProvider | RecoveryMetricsAdapter | Prisma: recovery tables |
| Contacts | IContactMetricsProvider | ContactMetricsAdapter | Prisma: contacts tables |

---

## Security & Tenant Isolation

1. **tenantId from auth context** — Never from user message or tool args
2. **Tools receive tenantId via `runConfig.configurable`** — Set by use case, not by LLM
3. **Guards**: JwtCookieGuard + TenantGuard on all endpoints
4. **System prompt**: Instructs agent to never reference other tenants
5. **Thread isolation**: threadId = `tenant_${tenantId}_user_${userId}_${uuid}`

---

## Dependencies to Add

```json
{
  "@langchain/langgraph": "^0.2.x"
}
```

Já temos: `@langchain/core`, `@langchain/openai`, `zod`.

---

## Environment Variables

```env
# Dashboard Agent specific
OPENROUTER_DASHBOARD_MODEL=anthropic/claude-sonnet-4
OPENROUTER_DASHBOARD_FALLBACK_MODEL=deepseek/deepseek-chat
DASHBOARD_AGENT_MAX_MESSAGES=20
DASHBOARD_AGENT_TIMEOUT_MS=60000
DASHBOARD_AGENT_RATE_LIMIT_PER_MINUTE=10
DASHBOARD_AGENT_RATE_LIMIT_DAILY=100
```

---

## Frontend Architecture

```
src/app/src/modules/dashboard/
├── components/
│   ├── DashboardChatWidget.tsx      # Floating chat button + panel
│   ├── DashboardChatMessages.tsx    # Message list with streaming
│   ├── DashboardChatInput.tsx       # Input + send button
│   ├── DashboardChatToolIndicator.tsx # Shows "Consultando vendas..."
│   └── DashboardChatSuggestions.tsx  # Niche-based quick questions
├── services/
│   └── dashboard-chat-service.ts    # SSE connection + message handling
└── view-models/
    └── useDashboardChatViewModel.ts # State management
```

---

## Niche-Based Suggested Questions

```typescript
const NICHE_SUGGESTIONS: Record<string, string[]> = {
  ECOMMERCE: [
    'Qual foi meu faturamento hoje?',
    'Quais produtos estão com estoque baixo?',
    'Quantos pedidos estão pendentes?',
    'Qual meu ticket médio este mês?',
  ],
  CLINIC: [
    'Como está a agenda de amanhã?',
    'Quantos pacientes atendi esta semana?',
    'Qual a taxa de no-show deste mês?',
    'Quais horários estão vagos hoje?',
  ],
  FOOD: [
    'Quantos pedidos entraram hoje?',
    'Qual o prato mais vendido esta semana?',
    'Tem algum item acabando no estoque?',
    'Qual o tempo médio de preparo?',
  ],
  SALON: [
    'Como está minha ocupação esta semana?',
    'Quantos agendamentos tenho amanhã?',
    'Qual serviço mais procurado este mês?',
    'Quantos clientes novos este mês?',
  ],
  RECOVERY: [
    'Quanto recuperei este mês?',
    'Qual a taxa de conversão das cobranças?',
    'Quais são os maiores devedores?',
    'Quantas cobranças estão programadas?',
  ],
  GENERIC: [
    'Qual foi meu faturamento esta semana?',
    'Quantos atendimentos estão em fila?',
    'Quantos contatos novos este mês?',
    'Como está o tempo de resposta?',
  ],
};
```

---

## Consequences

### Positive
- Reutiliza infraestrutura OpenRouter existente
- Tools são isolados e testáveis independentemente
- Nicho-aware: cada negócio vê apenas o que é relevante
- Streaming melhora UX (feedback imediato)
- Extensível: novo tool = nova classe + registro no map

### Negative
- Nova dependência (`@langchain/langgraph` ~2MB)
- Adapters precisam ser implementados para cada módulo de dados
- Custo por mensagem (tokens LLM + tool calls)

### Risks
- **R1**: Tools retornando dados grandes → mitigar com LIMIT e campos selecionados
- **R2**: LLM alucinando métricas → mitigar com output guardrails + instrução "only use data from tools"
- **R3**: Latência em multi-tool queries → mitigar com timeout + modelo rápido
