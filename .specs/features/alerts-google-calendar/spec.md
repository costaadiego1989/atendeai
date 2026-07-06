---
feature: alerts-google-calendar
status: specced
created: 2026-05-28
prefix: AGC
---

# Alerts — Google Calendar Integration

## Context

When a tenant user creates an alert reminder, the system should optionally create a corresponding event in that user's Google Calendar. Each system user is isolated — their alerts link to their own Google Calendar via the existing `GoogleCalendarConnectionScope` record (which already stores OAuth tokens per user). If the user has no Google Calendar connected, the alert is created normally without error.

## Requirements

| ID | Requirement |
|----|-------------|
| AGC-01 | When creating an alert reminder, if the current user has an active `GoogleCalendarConnectionScope`, automatically create a Google Calendar event with the same title, message, and scheduledAt |
| AGC-02 | Google Calendar event uses user's `calendarId` from their `GoogleCalendarConnectionScope` |
| AGC-03 | Store the resulting `googleEventId` in a new `AlertCalendarEventLink` table (alertId, userId, tenantId, googleEventId, calendarId) |
| AGC-04 | When updating an alert (title, message, scheduledAt), update the linked Google Calendar event if one exists |
| AGC-05 | When deleting an alert, delete the linked Google Calendar event if one exists |
| AGC-06 | Alert create/update/delete succeeds even if Google Calendar operation fails (graceful degradation — log error, do not throw) |
| AGC-07 | Per-user isolation: user A's alerts only link to user A's Google Calendar, never user B's |
| AGC-08 | If user connects Google Calendar after alerts were created, existing alerts are NOT backfilled (forward-only) |
| AGC-09 | Alert list response includes `googleCalendarLinked: boolean` per reminder |

## Out of Scope

- AGC-X1: OAuth flow for connecting Google Calendar (already exists in scheduling module)
- AGC-X2: Two-way sync (changes in Google Calendar reflected back in alerts)
- AGC-X3: Bulk backfill of existing alerts to Google Calendar
- AGC-X4: Multiple Google Calendar accounts per user

## Acceptance Criteria

1. User with active `GoogleCalendarConnectionScope` creates alert → event appears in their Google Calendar → `AlertCalendarEventLink` record created.
2. User updates alert title → Google Calendar event title updated.
3. User deletes alert → Google Calendar event deleted.
4. Google Calendar API returns 500 during alert creation → alert still created successfully, error logged.
5. User A and User B both create alerts with same title → each event in their own calendar, no cross-user data.
6. User with no connected Google Calendar creates alert → normal success, no `AlertCalendarEventLink`.

## Module Placement

- API: `src/api/src/modules/alerts/` — new port `IGoogleCalendarAlertPort`, new use-case logic
- Prisma: `scheduling_schema` — new model `AlertCalendarEventLink`
- Google Calendar access: via port that reads tokens from `GoogleCalendarConnectionScope` (cross-module via port, not direct import)
- Frontend: `src/app/src/modules/alerts/` — show calendar link badge on reminders with `googleCalendarLinked=true`
