# Módulo: `scheduling`

**Caminho:** `src/api/modules/scheduling`  
**Última análise:** 2026-05-04  
**Papel:** reservas, recorrências, reminders (Bull), integração pagamento (**`PaymentConfirmedIntegrationEvent`**, handlers), sincronização Google quando aplicável, eventos integration para messaging/payment flows.

## Estado da implementação (revisão 2026-05-04)

- **Pagamento confirmado ↔ Redis:** `markSlotPaymentConfirmedByReference` devolve `{ slot, appliedChange }`; `SchedulingPaymentEventHandler` evita efeitos colaterais em replay quando `appliedChange === false`.
- **Logs estruturados:** eventos tipo `scheduling.payment_confirmed.*`, `scheduling.reminders.queued_after_confirmation`, `scheduling.reservation.cancelled_payment_attention`, e processors Bull sob `scheduling.reminder.*` / expiração.
- **Lembretes:** timezone configurável **`SCHEDULING_REMINDER_TIMEZONE`** (IANA via Luxon; default em código `America/Sao_Paulo`).
- **Cancelamento automático (pré-pagamento):** timeout de hold configurável **`SCHEDULING_PENDING_PAYMENT_TIMEOUT_HOURS`** (0,5–720h; default código 3h); após **`expiresAt`**, Bull + `ExpirePendingSchedulingReservationUseCase` remove link, cancela pré-reserva, remove Google Calendar com **`branchId`**, log **`scheduling.pending_slot.auto_cancelled_unpaid`** / **`auto_cancel_skip`** (motivo).
- **Workers Bull:** `SchedulingReminderProcessor` (`scheduling.reminder.skipped_slot_inactive`, `scheduling.reminder.outbound_queued`); `SchedulingReservationExpirationProcessor` (`scheduling.pending_slot.expiration_job_ok` / `expiration_job_failed`).
- **Roadmap:** sala de espera; SLA de cancelamento pelo cliente (“até X horas antes”) por tenant/categoria.

## Valor ao utilizador / oportunidades

- Agendamentos reduzem atrito vs telefone/sobreposição manual.
- **Melhorias:** sala de espera; políticas de cancelamento cliente por tenant/prazo.
- **Features:** pagamento pré-reserva com estados bem modelados já parcialmente alinhados a eventos pagamento.

## Acoplamento / manutenção

- Usa **`ContactFacade`**, **`PaymentService`**, **`MessagingFacade`** (reminders outbound) — orquestração forte; eventos bem nomeados já servem como portas de comunicação com pagamentos.

## Logs e traces distribuídos

- Reminders: eventos `scheduling.reminder.outbound_queued` / `scheduling.reminder.skipped_slot_inactive` com contexto útil (`bull_job_id`, slot, offset em horas).
- Handlers pagamento ↔ slots: logs em replay sem side-effect (`appliedChange === false`).
- Expiração de pré-reserva: `scheduling.pending_slot.auto_cancel_skip` vs `scheduling.pending_slot.auto_cancelled_unpaid` (além dos eventos nível Bull `expiration_job_*`).

## KISS / DRY

- Reutilizar modelo de estado de reservation num único agregador; evitar ifs paralelos nos handlers e IA (`ReserveProfessionalSlotUseCase` já encadeado ao AI processor — manter esse caminho bem testado).
