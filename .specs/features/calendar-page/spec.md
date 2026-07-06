---
feature: calendar-page
status: specced
created: 2026-05-28
prefix: CAL
---

# Calendar Page (Frontend)

## Context

A dedicated calendar view in the sidebar that aggregates all time-based events for the current user: scheduling appointments, alert reminders, scheduled messages, and Google Calendar events (if connected). The page shows events per day/week/month and provides quick access to each event type.

## Requirements

### API

| ID | Requirement |
|----|-------------|
| CAL-01 | New endpoint `GET /tenants/:tenantId/calendar/events?start=ISO&end=ISO&branchId=?` returns unified list of calendar events |
| CAL-02 | Event types returned: `APPOINTMENT` (scheduling), `ALERT` (alert reminder), `SCHEDULED_MESSAGE`, `GOOGLE_CALENDAR` |
| CAL-03 | Each event: `id`, `type`, `title`, `startAt`, `endAt?`, `description?`, `sourceId` (original record ID), `color` (type-based) |
| CAL-04 | APPOINTMENT events: from scheduling module (appointments/reservations for branchId or current user) |
| CAL-05 | ALERT events: from alerts module (reminders with scheduledAt for current user) |
| CAL-06 | SCHEDULED_MESSAGE events: from messaging module (pending scheduled messages for current user) |
| CAL-07 | GOOGLE_CALENDAR events: from Google Calendar API if user has active `GoogleCalendarConnectionScope` |
| CAL-08 | Response scoped to authenticated user's tenantId + userId |
| CAL-09 | Endpoint supports date range up to 3 months |

### Frontend

| ID | Requirement |
|----|-------------|
| CAL-10 | New sidebar menu item "Calendário" in main nav with Calendar icon |
| CAL-11 | Route: `/app/calendar` |
| CAL-12 | Default view: monthly calendar |
| CAL-13 | View toggles: Month / Week / Day |
| CAL-14 | Events rendered as colored dots/chips on each day cell |
| CAL-15 | Each event type has distinct color: APPOINTMENT=blue, ALERT=amber, SCHEDULED_MESSAGE=green, GOOGLE_CALENDAR=indigo |
| CAL-16 | Clicking a day shows event list for that day |
| CAL-17 | Clicking an event opens a detail popover/drawer with: title, time, type badge, link to source module |
| CAL-18 | "Source link" navigates to the relevant page (e.g., `/app/settings/alerts` for alerts, `/app/scheduling` for appointments) |
| CAL-19 | Month/week navigation (prev/next arrows) |
| CAL-20 | Empty state message when no events in visible range |

## Out of Scope

- CAL-X1: Creating events directly from calendar page (navigate to source module for creation)
- CAL-X2: Drag-and-drop rescheduling
- CAL-X3: Calendar sharing or external export
- CAL-X4: Recurring event expansion beyond query range

## Acceptance Criteria

1. User with 1 alert at 2026-06-10, 1 appointment at 2026-06-15 → calendar shows both on correct days in June view.
2. Switch to week view → events for that week only.
3. Click event → drawer shows title, time, type, and "Ver detalhes" link.
4. User with Google Calendar connected → their Google Calendar events appear with indigo color.
5. User with no events in range → empty state shown.
6. Another tenant's events never appear.

## Module Placement

- API: new thin `calendar` module OR aggregation controller inside existing `scheduling` module — prefer new `calendar` module to avoid bloating scheduling
- Frontend: `src/app/src/modules/calendar/` (new module)
- Sidebar: `mainNav` in `AppLayout.tsx`
- Route: `/app/calendar`

## Notes

- Google Calendar events fetched server-side (avoids exposing OAuth tokens to frontend)
- Date range query: default to current month ± 15 days buffer
- Performance: parallel fetch from all 4 sources, merge and sort by startAt
