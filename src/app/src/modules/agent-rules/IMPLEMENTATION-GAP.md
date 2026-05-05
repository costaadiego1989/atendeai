# IMPLEMENTATION-GAP — `agent-rules` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `agent-rules` |
| Data | 2026-05-04 |
| API relacionada | `agent-rules` (`TenantAgentRuleController`) |

## Superfície já coberta

- Cliente: [`services/agent-rules-service.ts`](./services/agent-rules-service.ts)
- Rotas utilizadas:
  - `GET /tenants/:tenantId/agent-rules/:moduleId` (+ `branchId` opcional)
  - `PUT /tenants/:tenantId/agent-rules/:moduleId` (+ `branchId`)
  - `POST /tenants/:tenantId/agent-rules/:moduleId/preview` (+ `branchId`) — normalização / próxima revisão
  - `GET /tenants/:tenantId/agent-rules/:moduleId/history` (+ `branchId`, `limit`)

Backend: [`src/api/modules/agent-rules/presentation/controllers/TenantAgentRuleController.ts`](../../../../api/modules/agent-rules/presentation/controllers/TenantAgentRuleController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|

_Nenhuma lacuna catalogada neste momento._

## Alinhamento de contrato

- Comprimento do prompt customizado no UI alinhado ao DTO Nest (`UpsertTenantAgentRuleDto`: até 500 caracteres).
- `TenantAgentRule` no client deve espelhar campos obrigatórios dos DTOs da API (`scope`, `notes`, revisão).

## Verificação (Done when)

- Matriz manual ou teste MSW: cada rota acima retorna erro tratado na UI e persistência atualiza estado/cache (`react-query`).
- Contrato atualizado quando novos campos entrarem nos DTOs da API.
