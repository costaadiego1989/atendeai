# IMPLEMENTATION-GAP — `prospecting` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `prospecting` |
| Data | 2026-05-04 |
| API relacionada | `prospecting` (vários controllers: campanhas, search, ads, execution, reports) |

## Superfície já coberta

- Clientes: [`services/prospecting-service.ts`](./services/prospecting-service.ts) (reports globais), [`prospecting-campaign-service.ts`](./services/prospecting-campaign-service.ts), [`prospecting-search-service.ts`](./services/prospecting-search-service.ts), [`prospecting-ads-service.ts`](./services/prospecting-ads-service.ts).

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-PROS-001 | P1 | Auditoria linha-a-linha: `ProspectCampaignController`, `ProspectSearchController`, `ProspectAdsController`, `ProspectExecutionController`, `ProspectReportController` vs métodos nos quatro clients — rotas novas frequentes neste domínio | `src/api/modules/prospecting/presentation/controllers/` |
| APP-PROS-002 | P1 | ~~Jobs globais `/prospecting/reports/*` vs tenant-scoped~~ — listagens de campanhas/buscas e resultados enviam `branchId` na query quando existe filial ativa; `withBranchQuery` compõe `&branchId=` se o path já tiver query string | Código atual |
| APP-PROS-003 | P1 | Estados de execução/campanha visíveis na UI alinhados com enum backend (ex.: falha dispatch) | Domínio |

## Alinhamento de contrato

- `withBranchQuery` helpers devem aplicar-se a todos os endpoints que suportam `branchId` na API.

## Verificação (Done when)

- Checklist manual com coluna endpoint / ficheiro client / UI ecrã — actualizar quando API mudar.
- Smoke MSW para start/pause campaign + search report job.
