# IMPLEMENTATION-GAP — `checkout` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `checkout` |
| Data | 2026-05-04 |
| API relacionada | `commerce` (`CommerceController`); **pagamentos** também em [`payment`](../../../../api/modules/payment/presentation/controllers/) e [`sales`](../../../../api/modules/sales/presentation/controllers/SalesController.ts) |

## Superfície já coberta

- Cliente: [`services/checkout-service.ts`](./services/checkout-service.ts)
- Rotas utilizadas:
  - Política envio: `GET|PUT .../commerce/shipping-policy`
  - Pedidos: `GET .../commerce/orders`, CSV report download, `GET .../orders/:id`, `PUT .../orders/:id/status`
  - Abandono: `PUT .../abandonment`, `POST .../abandonment-touch`, `GET|PUT .../abandonment-config`, `POST .../abandonment-config/generate-message`
  - **Sessão de compra**: `GET .../commerce/catalog-search`; `POST .../commerce/sessions`; `GET .../sessions/:sessionId`; `POST .../sessions/:sessionId/items`; `PUT .../sessions/:sessionId/fulfillment`; `POST .../sessions/:sessionId/coupon`; `POST .../sessions/:sessionId/checkout`

Backend commerce: [`CommerceController.ts`](../../../../api/modules/commerce/presentation/controllers/CommerceController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-CHKT-002 | P1 | UX ou módulo dedicado (ex. POS/agente) para operações de sessão ou decisão explícita de que ficam só em `messaging`/outra área — documentar onde vive o fluxo | Produto |
| APP-CHKT-003 | P1 | Surfacing API **payment trial/signup** (`PaymentController`, `TrialSignupController`) — referência cruzada se aplicável ao onboarding | [`payment`](../../../../api/modules/payment/) |

## Alinhamento de contrato

- CSV report já usa URL absoluta `BASE_URL`; sessões usam os mesmos cookies/JWT que o restante do tenant.

## Verificação (Done when)

- Rotas de sessão cobertas no `checkout-service` com tipos alinhados aos DTOs Nest.
- Quando existir UI dedicada: MSW cobre happy path sessão até checkout.
