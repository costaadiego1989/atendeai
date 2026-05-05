# IMPLEMENTATION-GAP — `support` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `support` |
| Data | 2026-05-04 |
| API relacionada | `support` (`SupportFeedbackController`) |

## Superfície já coberta

- Cliente: [`services/support-service.ts`](./services/support-service.ts)
- Rotas utilizadas:
  - `GET /support/feedbacks` (`branchId` opcional)
  - `POST /support/feedbacks`

Backend: [`SupportFeedbackController.ts`](../../../../api/modules/support/presentation/controllers/SupportFeedbackController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-SUP-001 | P2 | API só lista/cria — sem update/delete no controller atual; se roadmap incluir status/resposta operador, UI ausente | Produto |
| APP-SUP-002 | P1 | Cobrir erros de validação `CreateSupportFeedbackDTO` com mensagens estáveis na UI | [`support` TEST-SPEC](../../../../api/modules/support/TEST-SPEC.md) |

## Alinhamento de contrato

- `tenantId` vem do JWT — não enviar tenant duplicado no body.

## Verificação (Done when)

- MSW ou teste componente FAB/contextual envia feedback com `appModule` e `pagePath`.
