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
| APP-USR-001 | P1 | Campos opcionais (`accessibleBranchIds`, `mustChangePassword`) devem espelhar contratos backend ao criar/editar | [x] Resolvido 2026-05-12 |

### Resolução APP-USR-001

**Problema:** `CreateTeamMemberInput` e `UpdateTeamMemberInput` declaravam `accessibleBranchIds?` e `mustChangePassword?`, mas o backend (`CreateUserDTO`, `UpdateUserDTO`) não aceita esses campos — são silenciosamente ignorados.

**Decisão:**
- `accessibleBranchIds` — gerenciado no módulo auth/branches (computado em login), não no CRUD de usuários. Removido dos inputs de mutação.
- `mustChangePassword` — hardcoded `true` na criação; limpo apenas via `ChangeFirstAccessPasswordUseCase`. Removido dos inputs de mutação; mantido como read-only no tipo `User` para exibição na UI.

**Alteração:** `users-service.ts` — removidos ambos os campos de `CreateTeamMemberInput` e `UpdateTeamMemberInput`.
| APP-USR-002 | P1 | ~~Guardas de papel (`OWNER` não pode remover último OWNER, etc.) — UX antecipada antes da chamada API~~ — Implementado em [`useTeamPageViewModel`](./view-models/useTeamPageViewModel.ts) + edição com papel `OWNER` apenas quando já proprietário | Domínio |

## Alinhamento de contrato

- Roles `'OWNER' \| 'ADMIN' \| 'AGENT'` consistentes com backend.

## Verificação (Done when)

- MSW cobre CRUD feliz + erro de domínio com toast específico.
