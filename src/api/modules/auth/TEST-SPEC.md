# TEST-SPEC — `auth`

## Objetivo

Confidencialidade de sessão, refresh seguro, throttling anti-abuso e resets com LGPD/consistência.

## IDs de cenários

Prefixo **`AUTH-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| AUTH-T-010 | Validação | Login/register/password-reset com campos inválidos e mensagens estáveis. |
| AUTH-T-020 | Sucesso | Refresh token válido renova cookie/sessão; logout invalida refresh. |
| AUTH-T-030 | Domínio | Credenciais inválidas, conta bloqueada, token revogado. |
| AUTH-T-040 | Segurança | Rate limit por IP/device (`DeviceAwareThrottlerGuard`). |
| AUTH-T-050 | Infra | Redis/session store indisponível — comportamento explícito (fail closed onde necessário). |

## Inventário atual

- Unit: use cases JWT, guards, throttle keys
- E2E: `auth.e2e-spec.ts`, `auth-password-reset.e2e-spec.ts`, `auth-controller-edge.e2e-spec.ts`
- Integration: Prisma auth repo, Redis refresh store

## Lacunas (prioridade)

- **P0:** matriz CSRF/cookies SameSite conforme ambientes de staging/production documentada em testes.
- **P1:** regressão OAuth/social se existir segundo fluxo paralelo.

## Referências no código

- `AuthModule`, `JwtTokenService`, controllers sob `presentation`.
