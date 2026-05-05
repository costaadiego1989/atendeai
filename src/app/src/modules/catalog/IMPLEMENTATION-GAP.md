# IMPLEMENTATION-GAP — `catalog` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `catalog` |
| Data | 2026-05-04 |
| API relacionada | `catalog`; integração produto ↔ [`inventory`](../../../../api/modules/inventory/inventory.module.ts) |

## Superfície já coberta

- Cliente: [`services/catalog-service.ts`](./services/catalog-service.ts)
- Rotas utilizadas (resumo): categorias CRUD; items CRUD + deactivate; upload; `POST .../report-jobs`; `POST .../reports` (resumo síncrono); `POST .../import-jobs`; `GET .../jobs`; `GET .../jobs/:jobId`; download via `BASE_URL`.

Backend: [`src/api/modules/catalog/presentation/controllers/CatalogController.ts`](../../../../api/modules/catalog/presentation/controllers/CatalogController.ts)

- UX exportação: botão **Ver resumo agora** chama `POST .../reports` e mostra totais num toast; **Baixar CSV** mantém jobs assíncronos.
- Job em foco (último export/import iniciado pelo utilizador): polling extra via `GET .../jobs/:jobId` além da lista.

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-CAT-003 | P0 | Fluxos que criam/atualizam item devem considerar vínculo stock/inventory quando SKU diverge — alerta UX em [`CatalogItemSheet`](./components/CatalogItemSheet.tsx) para produtos/locações com link para Estoque; validação forte continua no backend ([`catalog`](../../../../api/modules/catalog/TEST-SPEC.md)) | Domínio |

## Alinhamento de contrato

- Tipos de report/import jobs devem corresponder aos payloads dos DTOs `GenerateCatalogReportDTO` / import.

## Verificação (Done when)

- Import/report jobs cobertos por polling + download com cookie auth.
- Resumo síncrono e detalhe de job disponíveis no client conforme contrato Nest.
