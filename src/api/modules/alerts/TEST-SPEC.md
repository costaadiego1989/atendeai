# TEST-SPEC — `alerts`

## Objetivo

Lembretes e alertas agendados corretos (timezone, idempotência, corpo da mensagem), sem duplo disparo sob retry.

## IDs de cenários

Prefixo **`ALT-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| ALT-T-010 | Validação | Payload de criação de alerta inválido (data passada, canal inválido). |
| ALT-T-020 | Sucesso | Schedule calculado conforme regra de negócio local/Brazil. |
| ALT-T-030 | Domínio | Alerta cancelado/expirado não dispara processamento. |
| ALT-T-040 | Infra | Falha ao enviar mensagem — retry/backoff não duplica estado persistido. |

## Inventário atual

- Unit: `__tests__/alert-message-body.spec.ts`, `alert-reminder-schedule.spec.ts`, use cases specs.

## Lacunas (prioridade)

- **P0:** e2e ponta-a-ponta com fila Bull/cron simulado (se aplicável ao deployment).
- **P1:** propriedades em batch para janelas de silêncio.

## Referências no código

- `CreateAlertReminderUseCase`, `ProcessAlertReminderUseCase`, `alerts.module.ts`.
