# IMPLEMENTATION-GAP — `inventory` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `inventory` |
| Data | 2026-05-04 |
| API relacionada | `inventory` (`InventoryController`) |

## Superfície já coberta

- Cliente: [`services/inventory-service.ts`](./services/inventory-service.ts)
- Rotas utilizadas:
  - `GET|POST .../inventory/items`, `POST .../items/sync`
  - `GET|POST .../inventory/connections`
  - Jobs relatório: `POST .../inventory/report-jobs`, `GET .../inventory/jobs`, download job

Backend: [`InventoryController.ts`](../../../../api/modules/inventory/presentation/controllers/InventoryController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-INV-001 | P0 | **Sync por conexão** — client chama `POST …/inventory/connections/:connectionId/sync` ([`syncConnectionNow`](./services/inventory-service.ts)); botão **Sincronizar agora** nas conexões ativas ([`InventoryConnectionsTab`](./components/InventoryConnectionsTab.tsx)). **Backend:** confirmar rota ou alinhar path/método na API | [`inventory` TEST-SPEC](../../../../api/modules/inventory/TEST-SPEC.md) |
| APP-INV-002 | P1 | ~~Relatório síncrono `POST .../inventory/reports`~~ — exposto em [`inventory-service`](./services/inventory-service.ts) como `generateReportSync`; UI “Ver resumo agora” no sheet de relatórios | `InventoryController` |
| APP-INV-003 | P1 | ~~Detalhe job `GET .../inventory/jobs/:jobId`~~ — `getAsyncJob` + poll focado no VM (`focusedJobQuery`) | `InventoryController` |
| APP-INV-004 | P0 | **`sourceType` + `config`:** união alargada em [`shared/types`](../../shared/types/index.ts) (`InventoryConnectionSourceType`); integrações em [`useIntegrationsSettingsViewModel`](../../settings/view-models/useIntegrationsSettingsViewModel.ts) enviam `config` por campos do provedor (ex. Bling `accessToken`, Tiny `token`). Novos ERPs: acrescentar em `SUPPORTED_PROVIDERS` + tipo se necessário | `InventoryDTOs.ts` |

## Alinhamento de contrato

- `InventoryConnectionApiResponse.sourceType` no client deve convergir com valores aceites pela API **e** pelos providers efetivos.

## Verificação (Done when)

- Documentação ou UI lista cada provedor com campos `config` esperados (OAuth, URLs).
- ~~Botão “Sincronizar agora”~~ no app; tratamento de 404/erro quando a API ainda não expõe a rota.
