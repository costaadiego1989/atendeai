# TEST-SPEC — `recovery`

## Objetivo

Playbooks de recuperação de receita/churn — mensagens, agendamentos recorrentes e interação com IA sem violar opt-out.

## IDs de cenários

Prefixo **`REC-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| REC-T-010 | Validação | Payload registo de resposta/recovery reply. |
| REC-T-020 | Sucesso | Disparo de guidance/outreach dentro da janela permitida. |
| REC-T-030 | Domínio | Reply policy bloqueia tom/horário inadequado. |
| REC-T-040 | Infra | Recurring charge processor idempotente. |

## Inventário atual

- Unit diversos + `recovery.e2e-spec.ts`.

## Lacunas (prioridade)

- **P1:** template engine de playbooks vs injeção de conteúdo malicioso (escaping).

## Referências no código

- Handlers em `__tests__/`, services de playbook em `application`.
