# Módulo: `auth`

**Caminho:** `src/api/modules/auth`  
**Última análise:** 2026-05-03  

**Última implementação registada:** 2026-05-03 — `DeviceAwareThrottlerGuard`: dois contadores Redis por rota (IP via `resolveAuthThrottleIp` + device via cookie `device_id`, header `x-device-id` ou fallback SHA256 ip|UA). Cobre `login`, `refresh`, `forgot-password`, `reset-password`. Opcional `.env`: `AUTH_THROTTLE_LIMIT`, `AUTH_THROTTLE_TTL_SEC`. Desativa em `NODE_ENV=test`.

**Papel:** autenticação/autorização consumida por praticamente todos os controllers.

## Valor ao utilizador / oportunidades

- **Confiança:** MFA, sessões, políticas de password, auditoria de login.
- **Melhorias (pendentes roadmap):** limites combinados ao tenant onde fizer produto diferenciado; webhooks de segurança.
- **Enterprise:** SSO (SAML/OIDC) se roadmap o exigir — impacta `tenant` e políticas de convite.

## Acoplamento / manutenção

- Módulo transversal; evitar que **regras de negócio de produto** (quotas, módulos) vivam aqui — manter em `billing` / `tenant`.

## Logs e traces distribuídos

- Falhas de auth devem aparecer em logs HTTP globais; **evitar** logar credenciais ou tokens.
- Spans específicos para fluxos longos (refresh, reset) podem ajudar suporte N2.

## KISS / DRY

- Guards e strategies devem ser finos; lógica duplicada entre controllers → extrair para policies compartilhadas.
