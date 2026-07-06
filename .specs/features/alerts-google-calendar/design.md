---
feature: alerts-google-calendar
phase: design
---

# Design — Alerts Google Calendar Integration

## Prisma Model (scheduling_schema)

```prisma
model AlertCalendarEventLink {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  alertId       String   @unique @map("alert_id") @db.Uuid   // 1:1 per alert
  tenantId      String   @map("tenant_id") @db.Uuid
  userId        String   @map("user_id") @db.Uuid
  googleEventId String   @map("google_event_id") @db.VarChar(255)
  calendarId    String   @map("calendar_id") @db.VarChar(255)
  syncStatus    String   @default("SYNCED") @map("sync_status") @db.VarChar(20) // SYNCED | ERROR
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([tenantId, userId], name: "idx_alert_calendar_links_tenant_user")
  @@map("alert_calendar_event_links")
  @@schema("scheduling_schema")
}
```

## Port (alerts application layer)

```typescript
// alerts/application/ports/IGoogleCalendarAlertPort.ts
export interface GoogleCalendarEventInput {
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;   // startAt + 30 min default
  calendarId: string;
}

export interface IGoogleCalendarAlertPort {
  findUserCalendarScope(userId: string, tenantId: string): Promise<{
    calendarId: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date | null;
  } | null>;

  createEvent(accessToken: string, input: GoogleCalendarEventInput): Promise<string>; // returns googleEventId
  updateEvent(accessToken: string, calendarId: string, googleEventId: string, input: Partial<GoogleCalendarEventInput>): Promise<void>;
  deleteEvent(accessToken: string, calendarId: string, googleEventId: string): Promise<void>;
}
```

## Adapter (infrastructure)

```typescript
// alerts/infrastructure/adapters/GoogleCalendarAlertAdapter.ts
// - Reads GoogleCalendarConnectionScope from DB using userId + tenantId
// - Refreshes access token if expired (using refreshToken + Google OAuth endpoint)
// - Calls Google Calendar REST API v3
// - Does NOT import scheduling module directly — accesses DB via Prisma directly with scheduling_schema
```

## AlertCalendarEventLink Repository

```typescript
// alerts/infrastructure/repositories/PrismaAlertCalendarEventLinkRepository.ts
// - upsert(alertId, tenantId, userId, googleEventId, calendarId)
// - findByAlertId(alertId, tenantId): EventLink | null
// - deleteByAlertId(alertId, tenantId)
```

## Use Case Modification Strategy

Modify existing use cases to inject `IGoogleCalendarAlertPort` optionally:

```
CreateAlertReminderUseCase:
  1. Create alert (existing logic)
  2. calendarScope = await calendarPort.findUserCalendarScope(userId, tenantId)
  3. if (calendarScope):
       try:
         googleEventId = await calendarPort.createEvent(accessToken, {...})
         await linkRepo.upsert(alertId, tenantId, userId, googleEventId, calendarScope.calendarId)
       catch (e):
         logger.error('Google Calendar sync failed', e)  // graceful degradation

UpdateAlertReminderUseCase:
  1. Update alert (existing logic)
  2. link = await linkRepo.findByAlertId(alertId, tenantId)
  3. if (link): try { await calendarPort.updateEvent(...) } catch { log }

DeleteAlertReminderUseCase:
  1. link = await linkRepo.findByAlertId(alertId, tenantId)
  2. if (link): try { await calendarPort.deleteEvent(...) } catch { log }
  3. Delete alert (existing logic)
  4. Delete link record
```

## Token Refresh Logic

- Before each API call: check `tokenExpiresAt`. If expired or null → refresh with Google token endpoint.
- On successful refresh: update `GoogleCalendarConnectionScope.accessToken + tokenExpiresAt`.
- If refresh fails: log warning, skip Google Calendar operation (graceful degradation).

## Frontend Change

In `AlertsPage.tsx` / alert card: show `<CalendarIcon />` badge when `googleCalendarLinked = true`.
Alert list API response gains optional `googleCalendarLinked: boolean` field (no schema change on frontend types needed, just add to `AlertReminder` type).

## Tenant Isolation

- `findUserCalendarScope` always filters by `userId AND tenantId`
- `AlertCalendarEventLink` always scoped by `tenantId`
- No cross-user token access possible — each link stores its own `userId`
