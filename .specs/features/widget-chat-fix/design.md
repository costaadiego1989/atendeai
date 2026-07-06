# Widget Chat Fix — Design

## Architecture Overview

```
Browser (SDK)                   API (NestJS)                    Workers
─────────────                   ────────────                    ───────
getOrCreateVisitorId()  ──────► GET /widget/:token/config
localStorage restore    ──────► POST /widget/:token/sessions   ──► contactFacade.ensureContact()
                               (create OR resume by visitorId)  ──► initiateWidgetContact
                                                                    └─► conversation.create
                                                                    └─► [WIDGET_INIT] message
                                                                    └─► publish MessageReceived
                                                                         └─► outbox → BullMQ
                                                                              └─► AI handler
                                                                                   └─► AI reply saved

sendMessage()           ──────► POST /widget/:token/messages   ──► processWidgetMessage
                                                                    └─► contact.ensureContact
                                                                    └─► message.create (INBOUND)
                                                                    └─► publish MessageReceived
                                                                    └─► publish realtime event
                                                                         └─► internal app WebSocket

startPolling()          ──────► GET /sessions/:id/messages     ──► returns AI reply (OUTBOUND)

restartChat()           ──────► DELETE /sessions/:id            ──► session CLOSED
                                                                    └─► conversation ARCHIVED
```

## Changes by Layer

### 1. Backend: `WidgetController` — new DELETE endpoint

```typescript
// DELETE /api/v1/widget/:publicToken/sessions/:sessionId
@Delete(':publicToken/sessions/:sessionId')
async restartSession(
  @Param('publicToken') publicToken: string,
  @Param('sessionId') sessionId: string,
)
```

- Finds session by id + tenantId (from publicToken config).
- Sets `session.status = 'CLOSED'`.
- If session has conversationId: sets `conversation.status = 'ARCHIVED'`.
- Returns `{ success: true }`.

### 2. Backend: `ProcessWidgetMessageUseCase` — add realtime publish

After `transactionalEventPublisher.execute()` completes, call:
```typescript
await this.realtimePublisher.publish({
  type: 'message.received',
  tenantId: input.tenantId,
  conversationId: conversation.id,
  messageId: message.id,
  contactId,
  channel: 'WEB_CHAT',
  at: new Date().toISOString(),
});
```

Inject `IMessagingRealtimePublisher` via `@Inject(MESSAGING_REALTIME_PUBLISHER)`.

### 3. Backend: Contact phone validation

Check `IdentifyContactUseCase` — if it validates phone format strictly:
- Option A: Accept phones starting with `widget_` as valid identifiers (cheapest fix).
- Option B: Add `source?: 'widget'` to `ensureContact` input that bypasses phone normalization.

Chosen approach: validate in `IdentifyContactUseCase` — if phone starts with `widget_`, skip format normalization and store as-is.

### 4. Frontend SDK: `src/widget/src/sdk.ts`

#### Session persistence
```typescript
private saveSession(sessionId: string) {
  localStorage.setItem(`atendeai_session_${this.token}`, sessionId);
}

private restoreSession(): string | null {
  return localStorage.getItem(`atendeai_session_${this.token}`);
}

private clearSession() {
  localStorage.removeItem(`atendeai_session_${this.token}`);
}
```

Modified `initSession()`:
1. Try restoreSession() → if exists, validate via `GET /sessions/:id/messages` (200 = valid, otherwise clear + create new).
2. On successful `/sessions` response: call `saveSession(data.sessionId)`.

#### Restart button
Added to widget HTML header:
```html
<button class="aw-restart-btn" title="Reiniciar conversa" aria-label="Reiniciar conversa">
  <!-- reload icon SVG -->
</button>
```

`restartChat()` method:
```typescript
private async restartChat() {
  if (this.sessionId) {
    await fetch(`${this.baseUrl}/widget/${this.token}/sessions/${this.sessionId}`, {
      method: 'DELETE',
    }).catch(() => {});
  }
  this.clearSession();
  this.sessionId = null;
  this.messages = [];
  await this.initSession();
  this.renderMessages();
}
```

#### Polling improvement
- Extend auto-stop timeout from 30s → 90s.
- Only stop polling when last message is OUTBOUND AND at least 5s have passed since it arrived.
- Resume polling if user sends another message.

### 5. E2E Tests: `widget.e2e-spec.ts` expansions
New test blocks added to existing file:
- Contact creation check (query `prisma.contact` after session init).
- DELETE session endpoint (call + verify DB state).
- Restart creates fresh conversation.
- AI outbound message visible in GET messages (seed a fake AI message directly in DB).

### 6. Playwright Tests: `src/app/e2e/widget-chat.spec.ts`
New file in `bug-hunting` project (no auth, uses `page.route()` mocking).

Test setup:
- Mock `GET /widget/:token/config` → return widget config.
- Mock `POST /widget/:token/sessions` → return `{ sessionId, resumed: false }`.
- Mock `POST /widget/:token/messages` → return `{ messageId, conversationId, contactId }`.
- Mock `GET /sessions/:id/messages` → first call returns `[]`, second returns AI reply.
- Mock `DELETE /sessions/:id` → return `{ success: true }`.

Tests load a local HTML page with the widget SDK embedded.

## File Change Map

| File | Change |
|------|--------|
| `src/api/modules/messaging/presentation/controllers/WidgetController.ts` | Add DELETE endpoint |
| `src/api/modules/messaging/application/use-cases/ProcessWidgetMessageUseCase.ts` | Add realtime publish |
| `src/api/modules/messaging/__tests__/widget.e2e-spec.ts` | Expand tests |
| `src/widget/src/sdk.ts` | Session persistence + restart button + polling fix |
| `src/app/e2e/widget-chat.spec.ts` | New Playwright tests |
| `src/api/modules/contact/application/use-cases/IdentifyContactUseCase.ts` | Fix phone validation |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Phone format fix breaks existing contact lookup | Add `widget_` prefix check only in normalization step, not in dedup key |
| DELETE endpoint exposes SSRF via publicToken | publicToken is validated against DB; no external calls made |
| Realtime publish failure breaks widget message flow | Wrap realtime publish in try/catch; non-fatal if publisher fails |
| Playwright tests flaky (timing of AI reply poll) | Mock GET messages to return AI reply on 2nd call, with explicit wait |
