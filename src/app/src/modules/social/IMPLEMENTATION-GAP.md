# IMPLEMENTATION-GAP — `social` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `social` |
| Data | 2026-05-04 |
| API relacionada | `social` (`SocialController`, `SocialWebhookController`) |

## Superfície já coberta

- Cliente: [`services/social.service.ts`](./services/social.service.ts)
- Rotas utilizadas (resumo): contas list/delete/connect instagram; comentários list/thread/reply; inbox send; regras auto-reply CRUD/toggle; stats.

Backend: [`SocialController.ts`](../../../../api/modules/social/presentation/controllers/SocialController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-SOC-001 | P2 | Webhooks Meta (`SocialWebhookController`) são **infra backend** — SPA não implementa; manter runbook de verificação e assinatura | `SocialWebhookController` |
| APP-SOC-002 | P1 | Conferir novos endpoints ou query params em `SocialController` após upgrades da API (campos sentiment/status/hidden) | `SocialController` |

## Alinhamento de contrato

- `ListComments` resposta `{ data, meta }` deve tipar paginação igual à API.

## Verificação (Done when)

- MSW cobre listagem comentários + reply + toggle rule.
- Checklist manual webhook quando há novo deploy backend.
