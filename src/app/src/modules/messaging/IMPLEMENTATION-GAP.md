# IMPLEMENTATION-GAP — `messaging` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `messaging` |
| Data | 2026-05-12 |
| API relacionada | `messaging` (`MessagingController`, `WebhookController`); [`ai`](../../../../api/modules/ai/ai.module.ts) é maioritariamente **event-driven** (sem superfície REST principal para chat) |

## Superfície já coberta

- Clientes: [`services/messaging-service.ts`](./services/messaging-service.ts), [`services/messaging-realtime-service.ts`](./services/messaging-realtime-service.ts)
- Rotas REST típicas (`messaging-service`): conversas paginadas, mensagens, upload, status, suggest-reply, read.

Backend: [`MessagingController.ts`](../../../../api/modules/messaging/presentation/controllers/MessagingController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Status |
|----|------------|-----------|--------|
| APP-MSG-001 | P1 | Webhooks BubbleWhats/outros (`WebhookController`) não são consumidos pelo SPA — apenas backend; documentar exemplos de payload para QA | [x] Resolvido 2026-05-12 — [`WEBHOOK-RUNBOOK.md`](../../../../api/modules/messaging/WEBHOOK-RUNBOOK.md) |
| APP-MSG-002 | P1 | ~~Sugestão IA (`POST .../suggest-reply`)~~ — `getFriendlyErrorMessage` trata `402`/`429` e mensagens com quota/rate limit; toast de fallback orienta Cobrança/creditos | [x] Resolvido anteriormente |
| APP-MSG-003 | P2 | ~~Realtime vs REST~~ — comentário de topo em [`messaging-realtime-service.ts`](./services/messaging-realtime-service.ts) referencia REST vs WS | [x] Resolvido anteriormente |

## Alinhamento de contrato

- Paginação `meta` (`list conversations`): cliente aceita envelope `{ data, meta }` ou lista cruã e sintetiza `meta` quando necessário (alinha dashboards/listagens a APIs que omitam envelope).

## Verificação (Done when)

- MSW cobre lista mensagens + envio + suggest-reply com cookies.
- [x] Documentação webhook mantida em ambiente backend/runbooks — ver [`WEBHOOK-RUNBOOK.md`](../../../../api/modules/messaging/WEBHOOK-RUNBOOK.md).
