# TEST-SPEC — `scheduling`

## Objetivo

Reservas, Google Calendar/Meet, lembretes e expiração — sem double-booking perceptível ao utilizador.

## IDs de cenários

Prefixo **`SCH-T-NNN`**.

## Cenários prioritários (valor API)

| ID | Tipo | Descrição |
|----|------|-----------|
| SCH-T-010 | Validação | Intervalo horário inválido; timezone. |
| SCH-T-020 | Sucesso | Reserva pendente → confirmada com sync calendário. |
| SCH-T-030 | Domínio | Expiração de reserva; conflito de slot. |
| SCH-T-040 | Infra | Google API rate limit / token revogado. |

## Inventário atual

- Unit processors + `scheduling.e2e-spec.ts`, e2e Google Meet live (pode ser opcional em CI).

## Lacunas (prioridade)

- **P0:** mocks de Google para CI estável quando live e2e skipped.
- **P1:** reminder processor com horário de verão Brasil.

## Referências no código

- `SchedulingReminderProcessor`, `SchedulingGoogleCalendarSyncService`, `scheduling.module.ts`.
