---
feature: scheduled-messages
phase: tasks
---

# Tasks — Scheduled Messages

## T1 — Prisma: ScheduledMessage model
**What:** Add `ScheduledMessage` model to messaging_schema. Run migration.
**Where:** `src/api/prisma/schema.prisma`
**Done when:** `npx prisma migrate dev` succeeds, Prisma client regenerated.
**Gate:** `npx prisma generate`

## T2 — Domain: ScheduledMessage entity
**What:** Entity with PENDING→SENT/CANCELLED/FAILED state machine. `cancel()`, `markSent()`, `markFailed(reason)` methods.
**Where:** `messaging/scheduled-messages/domain/entities/ScheduledMessage.ts`
**Depends on:** T1
**Done when:** Unit tests cover state transitions, invalid transitions throw.
**Tests:** `ScheduledMessage.spec.ts`
**Gate:** `npm test -- --testPathPattern=ScheduledMessage`

## T3 — Infra: Repository + Queue producer
**What:** `PrismaScheduledMessageRepository` (findById tenantId-scoped, findPendingByConversation, save). `ScheduledMessageQueue` — adds delayed BullMQ job, returns jobId; removes job by jobId.
**Where:** `messaging/scheduled-messages/infrastructure/`
**Depends on:** T1
**Done when:** Unit tests with mocked Prisma + mocked BullMQ Queue.
**Tests:** `PrismaScheduledMessageRepository.spec.ts`, `ScheduledMessageQueue.spec.ts`
**Gate:** `npm test -- --testPathPattern=PrismaScheduledMessage|ScheduledMessageQueue`

## T4 — Infra: BullMQ Worker
**What:** `ScheduledMessageWorker` — receives `{scheduledMessageId}`, loads entity, verifies PENDING (idempotency), calls existing messaging send port, updates status SENT/FAILED.
**Where:** `messaging/scheduled-messages/infrastructure/queues/ScheduledMessageWorker.ts`
**Depends on:** T2, T3
**Done when:** Unit tests: success path (SENT), failure path (FAILED + reason), already-cancelled (skip).
**Tests:** `ScheduledMessageWorker.spec.ts`
**Gate:** `npm test -- --testPathPattern=ScheduledMessageWorker`

## T5 — Application: Use cases
**What:** `CreateScheduledMessageUseCase` (validates scheduledAt > now, creates entity, enqueues delayed job, stores jobId). `CancelScheduledMessageUseCase` (removes BullMQ job, updates CANCELLED). `ListScheduledMessagesUseCase` (PENDING by conversationId + tenantId).
**Where:** `messaging/scheduled-messages/application/use-cases/`
**Depends on:** T2, T3, T4
**Done when:** Unit tests cover: past scheduledAt → 422; cancel non-owned message → 403/404; cancel already-sent → 409.
**Tests:** `*ScheduledMessage*UseCase.spec.ts`
**Gate:** `npm test -- --testPathPattern=ScheduledMessage.*UseCase`

## T6 — Presentation: Controller
**What:** `ScheduledMessageController` with 3 endpoints (create, list, cancel). JWT guard, tenant scope validation.
**Where:** `messaging/scheduled-messages/presentation/`
**Depends on:** T5
**Done when:** E2E: schedule message → list pending → cancel → message not sent.
**Tests:** `scheduled-messages.e2e-spec.ts`
**Gate:** `npm run test:e2e -- --testPathPattern=scheduled-messages`

## T7 — Frontend: Schedule button + dialog
**What:** Add schedule button to conversation message input. `ScheduleMessageDialog.tsx` with datetime picker (min=now+1min). On confirm: POST `.../messages/schedule`.
**Where:** `src/app/src/modules/messaging/` (conversation view)
**Depends on:** T6
**Done when:** Can schedule a message from conversation UI, API call succeeds.
**Gate:** Dev server, manual test.

## T8 — Frontend: Pending message banner
**What:** `ScheduledMessageBanner.tsx` — fetches pending scheduled messages for current conversation on mount. Shows "Agendada para [datetime]" chip with cancel button. On cancel: DELETE, removes chip.
**Where:** `src/app/src/modules/messaging/` (conversation view)
**Depends on:** T7
**Done when:** Banner appears after scheduling, disappears after cancel.
**Gate:** Dev server, manual test.

## Execution Order

```
T1 → T2, T3 (parallel)
     T2, T3 → T4 → T5 → T6 → T7 → T8
```

## Traceability

| Task | Requirements |
|------|-------------|
| T1   | SCH-01 |
| T2   | SCH-01 |
| T3   | SCH-01, SCH-02 |
| T4   | SCH-02, SCH-03 |
| T5   | SCH-04, SCH-05, SCH-06, SCH-08, SCH-09 |
| T6   | SCH-05, SCH-08, SCH-09 |
| T7   | SCH-13, SCH-14 |
| T8   | SCH-15, SCH-16 |
