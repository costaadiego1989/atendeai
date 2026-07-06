---
feature: calendar-page
phase: tasks
---

# Tasks — Calendar Page

## T1 — API: Calendar module + aggregation endpoint
**What:** New `calendar` NestJS module. `GET /tenants/:tenantId/calendar/events` controller. Aggregation service: parallel-fetch from alerts repo, scheduling repo, scheduled-messages repo, Google Calendar adapter. Merge + sort by startAt. Return `CalendarEventDto[]`.
**Where:** `src/api/src/modules/calendar/`
**Depends on:** scheduled-messages T1 (for ScheduledMessage model), alerts-google-calendar T4 (for Google Calendar adapter)
**Done when:** Endpoint returns merged events from all 4 sources. Empty sources handled gracefully.
**Tests:** Unit test aggregation service with mocked sources. E2E: create 1 alert + 1 appointment → GET calendar events → both in response.
**Gate:** `npm run test:e2e -- --testPathPattern=calendar`

## T2 — Frontend: Calendar module skeleton + service
**What:** `src/app/src/modules/calendar/` with `CalendarPage.tsx`, `calendar-service.ts` (`GET .../calendar/events`), `useCalendarViewModel.ts` (manages current month, view mode, fetch).
**Where:** `src/app/src/modules/calendar/`
**Depends on:** T1
**Done when:** Page mounts, fetches events, no console errors.
**Gate:** Dev server starts.

## T3 — Frontend: Monthly calendar view
**What:** Render month grid using existing `calendar.tsx` UI component or custom grid. Show colored event dots per day. Prev/next navigation. Day click shows event list for that day.
**Where:** `src/app/src/modules/calendar/components/MonthView.tsx`
**Depends on:** T2
**Done when:** Events appear on correct days. Navigation changes month and refetches.
**Gate:** Dev server, manual verify.

## T4 — Frontend: Week + Day views
**What:** `WeekView.tsx`, `DayView.tsx`. Same event rendering with time slots. View toggle (Month/Week/Day) buttons.
**Where:** `src/app/src/modules/calendar/components/`
**Depends on:** T3
**Done when:** Toggle works, correct date range sent to API.
**Gate:** Dev server, manual verify.

## T5 — Frontend: Event detail popover/drawer
**What:** Click event → `EventDetailDrawer.tsx` with: title, type badge (colored), start/end time, description, "Ver detalhes" link to source module.
**Where:** `src/app/src/modules/calendar/components/EventDetailDrawer.tsx`
**Depends on:** T3
**Done when:** Drawer opens on event click, link navigates to correct source page.
**Gate:** Dev server, manual verify.

## T6 — Frontend: Sidebar + route wiring
**What:** Add "Calendário" item to `mainNav` in `AppLayout.tsx` (Calendar icon from lucide-react). Add route `/app/calendar` in router config pointing to `CalendarPage`.
**Where:** `AppLayout.tsx`, router config
**Depends on:** T2
**Done when:** Sidebar item visible, route renders page.
**Gate:** Dev server, navigation works.

## Execution Order

```
T1 → T2 → T3 → T4 (parallel with T5) → T6
              T5 (parallel with T4)
```

## Traceability

| Task | Requirements |
|------|-------------|
| T1   | CAL-01..CAL-09 |
| T2   | CAL-11 |
| T3   | CAL-12, CAL-14, CAL-15, CAL-16, CAL-19, CAL-20 |
| T4   | CAL-13 |
| T5   | CAL-17, CAL-18 |
| T6   | CAL-10, CAL-11 |
