# TEST-SPEC — `tenant`

## Objetivo

Bootstrap tenant, utilizadores, branches, integrações WhatsApp/Meta e promoções — invariantes multi-tenant e papéis.

## IDs de cenários

Prefixo **`TEN-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| TEN-T-010 | Validação | CNPJ/email/telefone VOs; configs JSON shape. |
| TEN-T-020 | Sucesso | CRUD feliz branches/users/settings. |
| TEN-T-030 | Domínio | Promoção sobreposta; branch inactive scope. |
| TEN-T-040 | AuthZ | Guards tenant + roles em todas as superfícies exposed. |
| TEN-T-050 | Infra | Twilio/Meta provisioning falha — rollback ou estado explícito `FAILED`. |

## Inventário atual

- Cobertura extensa (~57 ficheiros): unit + integration + múltiplos e2e.

## Lacunas (prioridade)

- **P1:** reduzir tempo total e2e via fixtures partilhadas mantendo isolamento por tenantId.
- **P1:** propriedades fuzz em value-objects (`CNPJ`, `Phone`) para inputs estranhos.

## Referências no código

- `tenant.module.ts`, facades e controllers sob `presentation`.
