# IMPLEMENTATION-GAP — `billing` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `billing` |
| Data | 2026-05-04 |
| API relacionada | `billing` (`SubscriptionController`, `UsageController`, `PublicBillingController`) |

## Superfície já coberta

- Cliente: [`services/billing-service.ts`](./services/billing-service.ts)
- Rotas utilizadas:
  - `GET /tenants/:tenantId/usage`
  - `GET /tenants/:tenantId/subscription/plans`
  - `PATCH /tenants/:tenantId/subscription/plan`
  - `POST /tenants/:tenantId/subscription/cancel`
  - `GET /tenants/:tenantId/subscription/catalog`
  - `PUT /tenants/:tenantId/subscription/modules`
  - `GET /public/billing/niches`
  - `GET /public/billing/modules`
  - `GET /public/billing/plans` (planos ativos pré-login; `billingService.listPublicPlans` + teaser no registro)
  - `GET /tenants/:tenantId/usage/export.csv` (download direto pelo browser; método `billingService.downloadUsageExportCsv`)

Backend: [`src/api/modules/billing/presentation/controllers/`](../../../../api/modules/billing/presentation/controllers/)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|

_Nenhuma lacuna catalogada neste momento._

## Alinhamento de contrato

- `BackendUsageResponse` deve seguir quotas devolvidas pelo backend (`messages`, `aiTokens`, `contacts`).
- Modos `CHECKOUT_REQUIRED` / `DOWNGRADE_SCHEDULED` em `changePlan` devem ter UX dedicada.

## Verificação (Done when)

- UI cobre fluxos changePlan/cancel/modules com feedback dos modos devolvidos pela API.
- Botão “Exportar uso (CSV)” na página de uso dispara download da rota `/usage/export.csv` (cookie enviado pelo browser na mesma origem).
- Pré-login: registro mostra teaser de planos base alimentado por `GET /public/billing/plans`.
