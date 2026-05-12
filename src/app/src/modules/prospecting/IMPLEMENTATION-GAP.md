# IMPLEMENTATION-GAP — `prospecting` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `prospecting` |
| Data | 2026-05-12 |
| API relacionada | `prospecting` (vários controllers: campanhas, search, ads, execution, reports) |

## Superfície já coberta

- Clientes: [`services/prospecting-service.ts`](./services/prospecting-service.ts) (reports + execution dispatch), [`prospecting-campaign-service.ts`](./services/prospecting-campaign-service.ts), [`prospecting-search-service.ts`](./services/prospecting-search-service.ts), [`prospecting-ads-service.ts`](./services/prospecting-ads-service.ts).

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Status |
|----|------------|-----------|--------|
| APP-PROS-001 | P1 | Auditoria controllers vs clients — tabela completa abaixo; gaps corrigidos | [x] Resolvido 2026-05-12 |
| APP-PROS-002 | P1 | ~~Jobs globais vs tenant-scoped~~ — `withBranchQuery` aplicado | [x] Resolvido anteriormente |
| APP-PROS-003 | P1 | Estados de execução/campanha visíveis na UI alinhados com enum backend | [x] Resolvido 2026-05-12 |

### Auditoria APP-PROS-001: Backend → Frontend

#### ProspectCampaignController (`/prospecting/campaigns`)

| Backend Route | Frontend Method | Match |
|---------------|-----------------|-------|
| `GET /campaigns` | `listCampaigns` | OK |
| `POST /campaigns` | `createCampaign` | OK |
| `POST /campaigns/message-suggestion` | `suggestCampaignMessage` | OK |
| `PATCH /campaigns/:id/activate` | `activateCampaign` | OK |
| `PATCH /campaigns/:id/pause` | `pauseCampaign` | OK |
| `POST /campaigns/:id/start` | `startCampaign` | OK |
| `POST /campaigns/:id/dispatch-next` | `dispatchNextCampaignExecution` | OK |

#### ProspectSearchController (`/prospecting/searches`)

| Backend Route | Frontend Method | Match |
|---------------|-----------------|-------|
| `GET /searches` | `listSearches` | OK |
| `POST /searches` | `createSearch` | OK |
| `GET /searches/:id/results` | `listSearchResults` | OK |
| `POST /searches/:id/import-contacts` | `importSearchResults` | OK |
| `POST /searches/:id/prospect` | `prospectSelectedResults` | OK |

#### ProspectAdsController (`/prospecting/ads`)

| Backend Route | Frontend Method | Match |
|---------------|-----------------|-------|
| `GET /ads/connection/status` | `getGoogleAdsConnectionStatus` | OK |
| `POST /ads/connection/start` | `startGoogleAdsConnection` | OK |
| `GET /ads/connection/callback` | — (OAuth redirect, não client-callable) | N/A |
| `GET /ads/connection/accounts` | `listGoogleAdsAccounts` | OK |
| `POST /ads/connection/select-account` | `selectGoogleAdsAccount` | OK |
| `DELETE /ads/connection` | `disconnectGoogleAdsConnection` | OK |
| `POST /ads/insights/queries` | `createAdsInsightQuery` | OK |
| `GET /ads/insights/queries` | `listAdsInsightQueries` | OK |
| `GET /ads/insights/queries/:id/results` | `listAdsInsightResults` | OK |
| `POST /ads/leads/sync` | `syncAdsLeads` | OK |
| `GET /ads/leads` | `listAdsLeads` | OK |
| `POST /ads/leads/import-contacts` | `importAdsLeads` | OK |
| `POST /ads/leads/prospect` | `prospectAdsLeads` | OK |

#### ProspectExecutionController (`/prospecting/executions`)

| Backend Route | Frontend Method | Match |
|---------------|-----------------|-------|
| `POST /executions/:id/dispatch` | `dispatchExecution` | OK (adicionado 2026-05-12) |

#### ProspectReportController (`/prospecting/reports`)

| Backend Route | Frontend Method | Match |
|---------------|-----------------|-------|
| `POST /reports/search-jobs` | `startSearchReportJob` | OK |
| `POST /reports/campaign-jobs` | `startCampaignReportJob` | OK |
| `GET /reports/jobs` | `listAsyncJobs` | OK |
| `GET /reports/jobs/:jobId` | `getAsyncJob` | OK (adicionado 2026-05-12) |
| `GET /reports/jobs/:jobId/download` | `downloadAsyncJobFile` | OK |

## Alinhamento de contrato

- `withBranchQuery` helpers aplicados a todos os endpoints que suportam `branchId` na API.
- `GET /ads/connection/callback` é redirect OAuth — intencionalmente excluído do client.

## Verificação (Done when)

- [x] Checklist endpoint / client completo (tabela acima).
- Smoke MSW para start/pause campaign + search report job.

### Resolução APP-PROS-003: Alinhamento de estados

**Problema:** `ProspectExecutionStatus` não existia como tipo nomeado (inline em 2 interfaces) e `RESPONDED` não tinha entrada no `StatusBadge`.

**Correções aplicadas (2026-05-12):**
1. Extraído tipo `ProspectExecutionStatus` em `shared/types/index.ts` (`'PENDING' | 'CONTACTED' | 'RESPONDED' | 'STOPPED' | 'FAILED'`)
2. Interfaces `ProspectCampaignStartResult` e `ProspectCampaignDispatchNextResult` agora referenciam o tipo nomeado
3. Adicionado `RESPONDED → { label: 'Respondeu', variant: 'success' }` no `StatusBadge.tsx`

**Alinhamento final:**

| Backend Enum | Frontend Type | StatusBadge | Status |
|---|---|---|---|
| `ProspectCampaignStatus` | `ProspectCampaignStatus` | Todos mapeados | OK |
| `ProspectExecutionStatus` | `ProspectExecutionStatus` | Todos mapeados | OK |
| `ProspectSearchStatus` | `ProspectSearchStatus` | Todos mapeados | OK |
