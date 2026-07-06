---
feature: alerts-google-calendar
phase: tasks
---

# Tasks — Alerts Google Calendar Integration

## T1 — Prisma: AlertCalendarEventLink model
**What:** Add `AlertCalendarEventLink` model to `scheduling_schema`. Run migration.
**Where:** `src/api/prisma/schema.prisma`
**Done when:** Migration applied, Prisma client regenerated.
**Gate:** `npx prisma generate`

## T2 — Port: IGoogleCalendarAlertPort
**What:** Define `IGoogleCalendarAlertPort` interface and `GoogleCalendarEventInput` DTO. Define DI token `GOOGLE_CALENDAR_ALERT_PORT`.
**Where:** `alerts/application/ports/`
**Depends on:** T1
**Done when:** Interface defined with 3 methods (findScope, createEvent, updateEvent, deleteEvent).
**Gate:** `npm run build` (TypeScript compile)

## T3 — Infra: AlertCalendarEventLink repository
**What:** `PrismaAlertCalendarEventLinkRepository` — upsert, findByAlertId, deleteByAlertId. All scoped by tenantId.
**Where:** `alerts/infrastructure/repositories/`
**Depends on:** T1
**Done when:** Unit tests with mocked Prisma pass.
**Tests:** `PrismaAlertCalendarEventLinkRepository.spec.ts`
**Gate:** `npm test -- --testPathPattern=AlertCalendarEventLink`

## T4 — Infra: GoogleCalendarAlertAdapter
**What:** Adapter implementing `IGoogleCalendarAlertPort`. Reads `GoogleCalendarConnectionScope` via Prisma. Token refresh logic (check expiry → POST to Google token endpoint → update scope record). Calls Google Calendar API v3 (create/update/delete event).
**Where:** `alerts/infrastructure/adapters/GoogleCalendarAlertAdapter.ts`
**Depends on:** T2
**Done when:** Unit tests with mocked HTTP and mocked Prisma. Test: expired token → refresh called → event created.
**Tests:** `GoogleCalendarAlertAdapter.spec.ts`
**Gate:** `npm test -- --testPathPattern=GoogleCalendarAlertAdapter`

## T5 — Application: Modify alert use cases
**What:** Inject `IGoogleCalendarAlertPort` into `CreateAlertReminderUseCase`, `UpdateAlertReminderUseCase`, `DeleteAlertReminderUseCase`. Add calendar sync logic with graceful degradation (try/catch, log on error).
**Where:** `alerts/application/use-cases/`
**Depends on:** T2, T3, T4
**Done when:** Unit tests cover: (a) user with scope → event created; (b) Google Calendar throws → alert still saved; (c) update alert → event updated; (d) delete alert → event deleted.
**Tests:** `*AlertReminder*UseCase.spec.ts`
**Gate:** `npm test -- --testPathPattern=AlertReminder.*UseCase`

## T6 — Presentation: API response includes googleCalendarLinked
**What:** Alert list and get endpoints return `googleCalendarLinked: boolean` (true if AlertCalendarEventLink exists for that alert).
**Where:** `alerts/presentation/`
**Depends on:** T3, T5
**Done when:** E2E: create alert with Google Calendar scope → list reminders response has `googleCalendarLinked: true`.
**Tests:** `alerts.controller.e2e-spec.ts`
**Gate:** `npm run test:e2e -- --testPathPattern=alerts`

## T7 — Frontend: Calendar link badge on alert cards
**What:** In `AlertsPage.tsx` alert card, show Google Calendar icon when `reminder.googleCalendarLinked === true`. Update `AlertReminder` type in shared types to include `googleCalendarLinked?: boolean`.
**Where:** `src/app/src/modules/alerts/`, `src/app/src/shared/types.ts`
**Depends on:** T6
**Done when:** Alert card shows calendar icon for linked alerts.
**Gate:** Dev server starts, icon renders.

## Execution Order

```
T1 → T2, T3 (parallel)
     T2 → T4
     T3, T4 → T5 → T6 → T7
```

## Traceability

| Task | Requirements |
|------|-------------|
| T1   | AGC-03 |
| T2   | AGC-01, AGC-02 |
| T3   | AGC-03 |
| T4   | AGC-01, AGC-02, AGC-06 |
| T5   | AGC-01, AGC-04, AGC-05, AGC-06, AGC-07, AGC-08 |
| T6   | AGC-09 |
| T7   | AGC-09 |
