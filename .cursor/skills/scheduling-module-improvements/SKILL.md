---
name: scheduling-module-improvements
description:
  Continuidade das melhorias do módulo scheduling (reservas, pagamento pré-reserva, Bull reminders,
  Google Calendar, Redis store). Use ao trabalhar em `src/api/modules/scheduling`,
  em `SchedulingPaymentEventHandler`, filas Bull de lembretes/expiração, ou ao alinhar com
  docs/api-modules-review/MODULE-scheduling.md.
---

# Melhorias do módulo `scheduling`

## Fonte de truth (brownfield)

- `docs/api-modules-review/MODULE-scheduling.md` — valor, acoplamento, logs/traces, KISS.

## Âmbito habitual

1. **Pagamento ↔ slot Redis:** `ISchedulingStore.markSlotPaymentConfirmedByReference` retorna `{ slot, appliedChange }`; replays idempotentes (ex.: webhook `payment.confirmed` já `PAID`) **não** devem repetir sync Calendar, WhatsApp, integration events nem enqueue de reminders.
2. **Observabilidade:** `StructuredLogEmitter` com eventos estáveis (`scheduling.payment_confirmed.*`, `scheduling.reminders.queued_after_confirmation`, `scheduling.reservation.cancelled_payment_attention`, `scheduling.reminder.*`, `scheduling.pending_slot.expiration_*`, `scheduling.pending_slot.auto_cancel_*`); correlacionar `bull_job_id` / `payment_id` / `raw_reference` quando útil ao suporte.
3. **Timezone dos lembretes:** zona IANA via `ConfigService.get('SCHEDULING_REMINDER_TIMEZONE')` (default código: `America/Sao_Paulo`), cálculos com Luxon — evitar offsets fixos.
4. **Hold pré-pagamento:** `ReserveProfessionalSlotUseCase` usa **`SCHEDULING_PENDING_PAYMENT_TIMEOUT_HOURS`** (clamp 0,5–720) quando não vem override no input; deve alinhar com `expiresAt` + Job Bull que dispara expiração.
5. **Acoplamentos:** `ContactFacade` não é sempre o foco aqui — `MessagingFacade` para outbound, event bus para integration events ligados ao pagamento; não duplicar políticas de estado entre handler e use cases de reserva.

## Convenções Nest

- Handlers e processors Bull no módulo existente; usar tokens `Symbol` já definidos em `scheduling.module.ts` ao injectar novas dependências.

## Ao encerrar trabalho neste tema

Atualizar a ficha `MODULE-scheduling.md` (data, observabilidade, idempotência) e uma linha na tabela de `docs/api-modules-review/ORCHESTRATOR.md` se o estado mudou materialmente.

## Relação com tlc-spec-driven

Features maiores (políticas de cancelamento automáticas, sala de espera, novo modelo recorrente) beneficiam de `spec/tasks` em `.specs/features/` antes de alterar fluxos já sensíveis a webhooks e filas.
