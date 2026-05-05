# IMPLEMENTATION-GAP — `dashboard` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `dashboard` |
| Data | 2026-05-04 |
| API relacionada | **Agregador**: delega para [`billing-service`](../billing/services/billing-service.ts), [`contacts-service`](../contacts/services/contacts-service.ts), [`messaging-service`](../messaging/services/messaging-service.ts), [`recovery`](../recovery/services/RecoveryService.ts), [`sales-service`](../sales/services/sales-service.ts), etc. |

## Superfície já coberta

- Cliente: [`services/dashboard-service.ts`](./services/dashboard-service.ts)
- Não define rotas próprias; compõe dados dos outros serviços com widgets configuráveis (`defaultDashboardWidgets` + queries por `queryKey`).

### Widget → dados (`getSnapshot` / KPIs)

Fonte única: [`dashboard-service.ts`](./services/dashboard-service.ts) (`getSnapshot`, `getMetrics`).

| Área | Serviço | Chamada principal |
|------|---------|-------------------|
| Uso do plano | `billingService` | `getUsage(tenantId)` |
| Métricas de vendas / período | `salesService` | `getMetrics(startDate, endDate, branchId)` |
| Lista de contactos (radar) | `contactsService` | `listContacts(tenantId, { page, limit, branchId })` |
| Conversas | `messagingService` | `listConversations(tenantId, { page, limit, branchId })` |
| Casos recovery | `recoveryService` | `listCases(tenantId, { branchId })` |
| Links / resumo checkout | `salesService` | `listPaymentLinks({ page, pageSize, branchId })` → `items` + `summary` |

**KPIs (`getMetrics.kpis`):** `sales.totalRevenue` e `payments.*` derivam de `snapshot.paymentSummary`; `conversations.waitingHuman` filtra `snapshot.conversations` por `PENDING_HUMAN`; `recovery.openAmount` agrega casos não `PAID`/`STOPPED`; `contacts.total` usa `snapshot.contacts.length`. Widgets gráfico/fila (`charts.revenue`, `queues.operations`) dependem da vista consumir estes dados — se algum `queryKey` não tiver fetcher dedicado, a lacuna está no módulo de origem (APP-DSH-001).

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-DSH-001 | P1 | Cada widget (`queryKey`) deve mapear para endpoint estável — quando lacuna existe no **serviço de origem**, corrigir lá e ligar aqui | Ver `IMPLEMENTATION-GAP.md` dos módulos citados |
| APP-DSH-002 | P1 | Export CSV uso (`billing`) ou métricas adicionais não refletidas nos KPIs | `UsageController`, `SalesController` |
| APP-DSH-003 | P2 | Endpoint dedicado “dashboard snapshot” na API (se criado no futuro) permitiria um único round-trip — hoje é N/A | Produto |

## Alinhamento de contrato

- `unavailableModules` deve derivar de falhas capturadas nos fetchers sem mascarar erro silencioso.

## Verificação (Done when)

- Teste integração ou Storybook dos widgets críticos com MSW mockando cada dependência.
- Lista explícita widget → serviço → rota mantida neste repositório (pode evoluir para tabela na doc).
