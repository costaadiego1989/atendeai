# IMPLEMENTATION-GAP — `dashboard` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `dashboard` |
| Data | 2026-05-12 |
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

**KPIs (`getMetrics.kpis`):** `sales.totalRevenue` e `payments.*` derivam de `snapshot.paymentSummary`; `conversations.waitingHuman` filtra `snapshot.conversations` por `PENDING_HUMAN`; `recovery.openAmount` agrega casos não `PAID`/`STOPPED`; `contacts.total` usa `snapshot.contacts.length`; `charts.revenue` conta pontos da série temporal de vendas; `queues.operations` soma handoff + casos de cobrança abertos.

### Tabela completa: Widget → Serviço → Endpoint

| queryKey | Widget | Serviço origem | Endpoint backend | Componente UI |
|----------|--------|----------------|------------------|---------------|
| `sales.totalRevenue` | Receita estimada | `salesService.listPaymentLinks` | `GET /sales/payment-links` | `DashboardWidgetRenderer` (KPI) |
| `payments.paidRevenue` | Pagamentos confirmados | `salesService.listPaymentLinks` | `GET /sales/payment-links` | `DashboardWidgetRenderer` (KPI) |
| `payments.newSaleRevenue` | Nova venda confirmada | `salesService.listPaymentLinks` + `recoveryService.listCases` | computed | `DashboardWidgetRenderer` (KPI) |
| `payments.recoveredRevenue` | Receita recuperada | `recoveryService.listCases` | `GET /recovery/cases` | `DashboardWidgetRenderer` (KPI) |
| `payments.activeLinks` | Pedidos em aberto | `salesService.listPaymentLinks` | `GET /sales/payment-links` | `DashboardWidgetRenderer` (KPI) |
| `conversations.waitingHuman` | Atendimento humano | `messagingService.listConversations` | `GET /messaging/conversations` | `DashboardWidgetRenderer` (KPI) |
| `recovery.openAmount` | Carteira em aberto | `recoveryService.listCases` | `GET /recovery/cases` | `DashboardWidgetRenderer` (KPI) |
| `contacts.total` | Novos contatos | `contactsService.listContacts` | `GET /contacts` | `DashboardWidgetRenderer` (KPI) |
| `charts.revenue` | Receita por período | `salesService.getMetrics` | `GET /sales/metrics` | `DashboardRevenueChart` (CHART) |
| `queues.operations` | Fila operacional | `messagingService` + `recoveryService` | computed | `DashboardOperationsPanel` (QUEUE) |

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Status |
|----|------------|-----------|--------|
| APP-DSH-001 | P1 | Cada widget (`queryKey`) deve mapear para endpoint estável — tabela documentada, `widgetMetrics` cobre todos os queryKeys | [x] Resolvido 2026-05-12 |
| APP-DSH-002 | P1 | Export CSV uso (`billing`) ou métricas adicionais não refletidas nos KPIs | [x] Resolvido 2026-05-12 |
| APP-DSH-003 | P2 | Endpoint dedicado "dashboard snapshot" na API (se criado no futuro) permitiria um único round-trip — hoje é N/A | [ ] N/A |

## Alinhamento de contrato

- `unavailableModules` deve derivar de falhas capturadas nos fetchers sem mascarar erro silencioso.
- Cada queryKey agora tem entrada correspondente em `widgetMetrics` (view-model) e `kpis` (service).

## Verificação (Done when)

- [x] Lista explícita widget → serviço → rota mantida neste repositório (tabela acima).
- [x] `widgetMetrics` no view-model cobre todos os 10 queryKeys definidos em `defaultDashboardWidgets`.
- [x] `getMetrics().kpis` no service retorna entradas para todos os queryKeys.
- [ ] Teste integração ou Storybook dos widgets críticos com MSW mockando cada dependência.
