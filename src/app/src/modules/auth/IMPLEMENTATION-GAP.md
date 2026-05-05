# IMPLEMENTATION-GAP — `auth` (frontend)

## Metadados

| Campo | Valor |
|-------|--------|
| Módulo app | `auth` |
| Data | 2026-05-04 |
| API relacionada | `auth` (`AuthController`), fluxos públicos (`PublicBillingController` consumidos por onboarding podem cruzar em outros módulos) |

## Superfície já coberta

- Cliente: [`services/auth-service.ts`](./services/auth-service.ts)
- Rotas utilizadas (amostra principal):
  - `POST /auth/login`
  - `GET /auth/me`
  - `POST /auth/logout`
  - `POST /auth/register` (tenant bootstrap conforme implementação atual)
  - `POST /auth/forgot-password`
  - `POST /auth/reset-password`
  - `POST /auth/first-access-password`

Backend: [`src/api/modules/auth/presentation/controllers/AuthController.ts`](../../../../api/modules/auth/presentation/controllers/AuthController.ts)

- **Refresh cookie**: `POST /auth/refresh` é chamado pelo cliente HTTP (`tryRefreshSession` em [`shared/api/client.ts`](../../shared/api/client.ts)) em sequência a `401` para rotas elegíveis, antes de falhar ou redirecionar ao login.

## Lacunas (requisitos)

| ID | Prioridade | Descrição | Referência backend |
|----|------------|-----------|---------------------|
| APP-AUTH-002 | P1 | Mensagens de throttling por IP/device alinhadas aos erros HTTP do backend | [`src/api/modules/auth/TEST-SPEC.md`](../../../../api/modules/auth/TEST-SPEC.md) |

## Alinhamento de contrato

- `unwrapResponse` deve cobrir envelopes `{ data }` para todos os endpoints críticos de sessão.

## Verificação (Done when)

- Testes de contrato ou MSW para login/me/logout/forgot/reset/first-access com payloads válidos e inválidos.
- Documentação curta no código sobre cookie SameSite conforme ambientes.
