# IMPLEMENTATION-GAP — `platform-admin` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `platform-admin` |
| Data | 2026-05-04 |
| API relacionada | `platform-admin` (`PlatformTenantsController`) |

## Superfície já coberta

- Cliente: [`services/platform-admin.service.ts`](./services/platform-admin.service.ts) (`platformAdminClient` separado do tenant cookie).
- Rotas utilizadas:
  - `GET /platform/tenants`
  - `PATCH /platform/tenants/:tenantId/quotas`
  - `POST .../messages/draft`
  - `POST .../messages/send`

Backend: [`PlatformTenantsController.ts`](../../../../api/modules/platform-admin/presentation/controllers/PlatformTenantsController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-PADM-001 | P1 | ~~Filtros listagem~~ — `listTenants` repassa `search`, `plan`, `tenantPlanStatus`, `subscriptionStatus` opcionais; UI com debounce em **Buscar tenant** (`search`). Novos campos do DTO: acrescentar no serviço + estado. | Controller |
| APP-PADM-002 | P0 | **`getFriendlyErrorMessage`** mapeia **403/401** com texto seguro; testes Vitest [`error-message-platform-admin.test.ts`](../../shared/api/error-message-platform-admin.test.ts). Suites RTL antigas podem exigir `@testing-library/dom` instalado; MSW/e2e opcional ([`TEST-SPEC`](../../../../api/modules/platform-admin/TEST-SPEC.md)) | Guards |

## Alinhamento de contrato

- Tipos em [`types/platform-admin.types`](./types/platform-admin.types.ts) espelham DTOs `AdjustQuotasResponseDto`, lista paginada (`PlatformTenantsListDto`), etc.

## Verificação (Done when)

- Fluxo feliz lista → ajustar quotas → draft → enviar mensagem documentado em fixture ou e2e smoke.
- Erros de API mapeados para toast legível sem vazar segredos.
