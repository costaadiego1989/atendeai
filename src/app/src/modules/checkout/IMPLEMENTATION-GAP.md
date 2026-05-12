# IMPLEMENTATION-GAP — `checkout` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `checkout` |
| Data | 2026-05-12 |
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

| ID | Prioridade | Descrição | Status |
|----|------------|-----------|--------|
| APP-CHKT-002 | P1 | UX sessão de compra — decisão arquitetural documentada (ADR abaixo) | [x] Resolvido 2026-05-12 |
| APP-CHKT-003 | P1 | Surfacing API **payment trial/signup** — referência cruzada documentada (ver seção abaixo) | [x] Resolvido 2026-05-12 |

## ADR: Sessões de compra são AI-driven (APP-CHKT-002)

**Contexto:** O backend expõe endpoints REST para manipulação de sessões de compra (criar, adicionar itens, fulfillment, coupon, checkout). O frontend `checkout-service.ts` já wrapa todos esses endpoints. Porém nenhuma UI no SPA invoca esses métodos diretamente.

**Decisão:** Sessões de compra são exclusivamente conduzidas pelo motor de IA conversacional (`AdvanceCommerceConversationUseCase`). Não há UI POS/agente dedicada para manipulação manual de sessões.

**Justificativa:**
1. O produto é AI-first — o fluxo de compra acontece dentro da conversa WhatsApp/Instagram
2. O `AdvanceCommerceConversationUseCase` implementa uma state machine completa: `IDENTIFYING_NEED` → `SELECTING_ITEM` → `AWAITING_QUANTITY` → `ASKING_MORE_ITEMS` → `AWAITING_FULFILLMENT` → `AWAITING_DELIVERY_ADDRESS` → `AWAITING_ORDER_NOTE` → `READY_FOR_CHECKOUT` → `AWAITING_PAYMENT` → `PAID`
3. Os endpoints REST existem para uso programático (integrações, testes, extensões futuras)
4. O dashboard de checkout (`CheckoutPage.tsx`) foca em gestão de pedidos, KPIs, abandono e shipping — não em criação manual de sessões

**Consequências:**
- Os métodos de sessão em `checkout-service.ts` permanecem como API programática (não removidos)
- Se no futuro o produto decidir por um POS/agente manual, a camada de serviço já está pronta
- Testes E2E de sessão cobrem o fluxo via API (não via UI)

### Fluxo documentado: Sessão de compra

```
Contato envia mensagem (WhatsApp/Instagram)
  → ProcessInboundMessageUseCase
    → AI detecta intenção de compra
      → AdvanceCommerceConversationUseCase (state machine)
        → startCommerceSession (POST /sessions)
        → addItem (POST /sessions/:id/items)
        → setFulfillment (PUT /sessions/:id/fulfillment)
        → applyCoupon (POST /sessions/:id/coupon) [opcional]
        → checkout (POST /sessions/:id/checkout)
          → Cria Order + Payment Link
          → Envia link ao contato via mensagem
```

### Métodos disponíveis no service (uso programático)

| Método | Endpoint | Uso |
|--------|----------|-----|
| `searchCommerceCatalog` | `GET /commerce/catalog-search` | Busca itens do catálogo |
| `startCommerceSession` | `POST /commerce/sessions` | Inicia sessão (requer `conversationId`) |
| `getCommerceSession` | `GET /commerce/sessions/:id` | Estado atual da sessão |
| `addCommerceSessionItem` | `POST /commerce/sessions/:id/items` | Adiciona item |
| `updateCommerceSessionFulfillment` | `PUT /commerce/sessions/:id/fulfillment` | Define entrega |
| `applyCommerceSessionCoupon` | `POST /commerce/sessions/:id/coupon` | Aplica cupom |
| `checkoutCommerceSession` | `POST /commerce/sessions/:id/checkout` | Finaliza → order + link |

## Alinhamento de contrato

- CSV report já usa URL absoluta `BASE_URL`; sessões usam os mesmos cookies/JWT que o restante do tenant.
- Sessões sempre vinculadas a `conversationId` — sem sessão órfã.

## Verificação (Done when)

- [x] Rotas de sessão cobertas no `checkout-service` com tipos alinhados aos DTOs Nest.
- [x] Decisão arquitetural documentada (ADR acima).
- [x] Referência cruzada trial/signup documentada (abaixo).
- [ ] Quando existir UI dedicada (futuro): MSW cobre happy path sessão até checkout.

---

## Referência Cruzada: Payment Trial/Signup (APP-CHKT-003)

### Endpoints backend (módulo `payment`)

| Controller | Rota | Propósito |
|------------|------|-----------|
| `TrialSignupController` | `POST /public/payments/trial/signup` | Cria tenant + subscription trial 7 dias (Asaas) |
| `PaymentController` | `POST /webhooks/asaas` | Webhook Asaas (não user-facing) |
| `PaymentManagementController` | `GET /tenants/:tenantId/payment/account/status` | Status da conta financeira |
| `PaymentManagementController` | `POST /tenants/:tenantId/payment/account/bootstrap` | Bootstrap sub-conta Asaas |

### Superfícies que consomem trial/signup

| Superfície | Localização | Endpoint chamado |
|------------|-------------|------------------|
| Landing page (trial signup) | `src/web/src/components/TrialSignupDialog.tsx` | `POST /public/payments/trial/signup` |
| App RegisterPage | `src/app/src/modules/auth/views/RegisterPage.tsx` | `POST /tenants` (sem trial) |
| App TrialBanner | `src/app/src/components/TrialBanner.tsx` | Exibe countdown, link para billing |
| App billing changePlan | `src/app/src/modules/billing/services/billing-service.ts` | `POST .../subscription/change` → `checkoutUrl` |

### Decisão arquitetural

- **Landing page (`src/web`)** é a superfície canônica para trial signup com integração Asaas.
- **App RegisterPage** usa path separado (`POST /tenants`) intencionalmente — é para criação de tenant sem trial (ex: convite, migração).
- O **checkout module** não precisa surfacear trial/signup diretamente — o fluxo de conversão trial→pago é responsabilidade do módulo `billing` (via `changePlan` → `checkoutUrl`).
- O `TrialBanner` no app já direciona tenants trial para a página de billing para upgrade.
- **Não há onboarding wizard** no checkout — se necessário no futuro, pode usar `POST .../payment/account/bootstrap` para setup da conta financeira.
