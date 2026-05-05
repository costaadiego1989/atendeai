# TEST-SPEC — `platform-admin`

## Objetivo

Operações cross-tenant apenas para staff — fronteiras duras entre admin global e dados de cliente.

## IDs de cenários

Prefixo **`PADM-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| PADM-T-010 | AuthZ | Utilizador tenant comum → 403 em todas as rotas admin. |
| PADM-T-020 | Sucesso | Operação feliz com papel `PLATFORM_ADMIN` (ou equivalente). |
| PADM-T-030 | Domínio | Ação irreversível requer confirmação/correlation id. |
| PADM-T-040 | Auditoria | Evento ou log estruturado com `actorId` e alvo tenant. |

## Inventário atual

- 4 ficheiros de teste — cobertura limitada face ao risco.

## Lacunas (prioridade)

- **P0:** suite e2e dedicada com matriz de papéis e tentativas de IDOR entre tenants.
- **P1:** testes de regressão para novos endpoints admin (checklist em PR).

## Referências no código

- `platform-admin.module.ts`, controllers e guards aplicados.
