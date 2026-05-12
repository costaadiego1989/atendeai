# IMPLEMENTATION-GAP — `sales` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `sales` |
| Data | 2026-05-04 |
| API relacionada | `sales` (`SalesController`); `payment` (`PaymentManagementController` para conta financeira) |

## Superfície já coberta

- Orquestração: [`services/sales-service.ts`](./services/sales-service.ts) reexporta métricas, payment links (incl. charges), conta financeira, IA, promoções, cupons.
- Rotas exemplificativas: `GET/POST/PATCH/DELETE /sales/links`, `/sales/charges`, `/sales/metrics`, `/sales/coupons` CRUD, `POST .../sales/links/ai-suggestions`, `/tenants/:id/payment/account/*`.

Backend: [`SalesController.ts`](../../../../api/modules/sales/presentation/controllers/SalesController.ts), [`PaymentManagementController.ts`](../../../../api/modules/payment/presentation/controllers/PaymentManagementController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| ~~APP-SAL-001~~ | ~~P1~~ | ~~Redeem cupom~~ — [`redeemCoupon` / `redeemCouponById`](./services/sales-coupons-service.ts) | `SalesController` |
| ~~APP-SAL-002~~ | ~~P1~~ | ~~CSV links~~ — [`downloadPaymentLinksReport`](./services/sales-payment-links-service.ts) usa `GET /sales/links/report.csv` | `SalesController` |
| APP-SAL-003 | P1 | Promoções: possível sobreposição com fluxo `tenant` (`/tenants/:id/promotions`) também usado em settings — evitar divergência de origem de verdade. **Resolvido:** são conceitos distintos (comercial vs informativo) com storage separado. Documentação de escopo adicionada em `sales-promotions-service.ts`, `usePromotionsViewModel.ts` e `usePromotionsSettingsViewModel.ts`. | `TenantController` |

## Alinhamento de contrato

- `withBranchQuery` em criação de links/charges deve seguir o que `SalesController` espera (`branchId` query/body conforme backend).

## Verificação (Done when)

- UI ou fluxo que consuma redeem quando o produto exigir (o client já expõe os dois `POST`).
- Teste MSW cobre criação/pause/resume link + sugestões IA.
