# IMPLEMENTATION-GAP — `users` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `users` |
| Data | 2026-05-04 |
| API relacionada | `tenant` (`UserController`) |

## Superfície já coberta

- Cliente: [`services/users-service.ts`](./services/users-service.ts)
- Rotas utilizadas:
  - `GET /tenants/:tenantId/users`
  - `POST /tenants/:tenantId/users`
  - `PUT /tenants/:tenantId/users/:userId`
  - `DELETE /tenants/:tenantId/users/:userId`

Backend: [`UserController.ts`](../../../../api/modules/tenant/presentation/controllers/UserController.ts)

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-USR-001 | P1 | Campos opcionais (`accessibleBranchIds`, `mustChangePassword`) devem espelhar contratos backend ao criar/editar | `UserController` + entidades tenant |
| APP-USR-002 | P1 | ~~Guardas de papel (`OWNER` não pode remover último OWNER, etc.) — UX antecipada antes da chamada API~~ — Implementado em [`useTeamPageViewModel`](./view-models/useTeamPageViewModel.ts) + edição com papel `OWNER` apenas quando já proprietário | Domínio |

## Alinhamento de contrato

- Roles `'OWNER' \| 'ADMIN' \| 'AGENT'` consistentes com backend.

## Verificação (Done when)

- MSW cobre CRUD feliz + erro de domínio com toast específico.
