# TEST-SPEC — `contact`

## Objetivo

CRUD identidade + CRM timeline estáveis; LGPD em delete/export quando existir política.

## IDs de cenários

Prefixo **`CON-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| CON-T-010 | Validação | Telefone/email formato; tenant obrigatório. |
| CON-T-020 | Sucesso | Create/update/list/detail felizes. |
| CON-T-030 | Domínio | Identify merge rules; estágio ilegal; delete em uso. |
| CON-T-040 | Integração | Timeline ordenação e cursores se existirem. |

## Inventário atual

- Unit extensivo + integration repos + vários e2e (`contact.e2e-spec.ts`, timeline, controller).

## Lacunas (prioridade)

- **P1:** rate limiting em endpoints públicos de identify se expostos.

## Referências no código

- `contact.module.ts`, `ContactDomainEventPublisher`.
