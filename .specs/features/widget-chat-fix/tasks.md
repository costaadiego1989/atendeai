# Widget Chat Fix — Tasks

## Status Legend
- [ ] TODO
- [>] IN PROGRESS
- [x] DONE
- [!] BLOCKED

---

## T01 — Diagnose contact phone validation
**Where**: `src/api/modules/contact/application/use-cases/IdentifyContactUseCase.ts`
**What**: Check if `widget_${uuid}` phone fails format validation. Fix to accept widget phones.
**Done when**: `contactFacade.ensureContact({ phone: 'widget_abc123' })` creates contact without throwing.
**Tests**: Unit test in `IdentifyContactUseCase.spec.ts` covering synthetic phone.
**Gate**: `cd src/api && npm test -- --testPathPattern=IdentifyContact`

- [ ] Read `IdentifyContactUseCase.ts`
- [ ] If phone regex exists: add `widget_` prefix bypass
- [ ] Add unit test for synthetic phone

---

## T02 — Add realtime publish to ProcessWidgetMessageUseCase
**Where**: `src/api/modules/messaging/application/use-cases/ProcessWidgetMessageUseCase.ts`
**What**: Inject `IMessagingRealtimePublisher`, call `publish()` after DB write completes.
**Done when**: After `execute()`, realtime event `message.received` is published for internal app WebSocket.
**Tests**: Update `ProcessWidgetMessageUseCase.spec.ts` — verify `realtimePublisher.publish` called.
**Gate**: `cd src/api && npm test -- --testPathPattern=ProcessWidgetMessage`

- [ ] Inject `MESSAGING_REALTIME_PUBLISHER` in constructor
- [ ] Call `realtimePublisher.publish()` after `transactionalEventPublisher.execute()` resolves
- [ ] Wrap in try/catch (non-fatal)
- [ ] Update unit test

---

## T03 — Add DELETE /widget/:token/sessions/:sessionId endpoint
**Where**: `src/api/modules/messaging/presentation/controllers/WidgetController.ts`
**What**: Archive session + conversation on restart request.
**Done when**: `DELETE /api/v1/widget/:token/sessions/:id` returns 200, session.status='CLOSED', conversation.status='ARCHIVED'.
**Tests**: New block in `widget.e2e-spec.ts` — call DELETE, verify DB state.
**Gate**: `cd src/api && npm run test:e2e -- --testPathPattern=widget.e2e`

- [ ] Add `@Delete(':publicToken/sessions/:sessionId')` handler
- [ ] Validate session belongs to publicToken's tenant
- [ ] Update `widgetSession.status = 'CLOSED'`
- [ ] Update `conversation.status = 'ARCHIVED'` if conversationId exists
- [ ] Return `{ success: true }`

---

## T04 — Fix SDK session persistence in localStorage
**Where**: `src/widget/src/sdk.ts`
**What**: Persist `sessionId` in localStorage; restore on init; clear on restart.
**Done when**: Page reload restores session without creating a new one (no extra `/sessions` call with `resumed: false`).
**Tests**: Playwright test `widget-chat.spec.ts` — reload page, verify messages load.
**Gate**: Playwright test passes.

- [ ] Add `saveSession(sessionId)` → `localStorage.setItem`
- [ ] Add `restoreSession()` → `localStorage.getItem`
- [ ] Add `clearSession()` → `localStorage.removeItem`
- [ ] Modify `initSession()`: check localStorage first, validate with GET messages
- [ ] Save sessionId after every successful session init/resume

---

## T05 — Add restart button to SDK + call DELETE endpoint
**Where**: `src/widget/src/sdk.ts`
**What**: "Reiniciar conversa" button in widget header; calls DELETE, clears state, re-inits.
**Done when**: Clicking restart → session CLOSED in backend → widget shows fresh empty chat.
**Tests**: Playwright test — click restart, verify chat clears.
**Gate**: Playwright test passes.

- [ ] Add restart button HTML to `getWidgetHTML()`
- [ ] Add CSS for restart button
- [ ] Bind click handler in `bindEvents()`
- [ ] Implement `restartChat()` method
- [ ] Call `clearSession()` + reset `this.messages` + `this.sessionId`

---

## T06 — Fix widget polling reliability
**Where**: `src/widget/src/sdk.ts`
**What**: Extend timeout to 90s; don't stop on first OUTBOUND message; stop only after 5s quiet.
**Done when**: Widget waits up to 90s for AI reply, polls every 1.5s.
**Tests**: Playwright test — AI reply mocked with 2s delay, widget displays it.
**Gate**: Playwright test passes.

- [ ] Change `setTimeout(() => this.stopPolling(), 30000)` → 90000
- [ ] Track `lastOutboundAt` timestamp
- [ ] Stop polling when `Date.now() - lastOutboundAt > 5000` (not immediately on first OUTBOUND)

---

## T07 — Expand widget.e2e-spec.ts integration tests
**Where**: `src/api/modules/messaging/__tests__/widget.e2e-spec.ts`
**What**: Add tests for contact creation, session restart, AI message visibility.
**Done when**: All new test blocks pass with `npm run test:e2e`.
**Gate**: `cd src/api && npm run test:e2e -- --testPathPattern=widget.e2e`

New tests:
- [ ] `should create a contact in DB after session init` (REQ-W02)
- [ ] `should load message history on session resume` (REQ-W01)
- [ ] `DELETE /sessions/:id should archive session and conversation` (REQ-W05)
- [ ] `after restart, new session creates new conversation` (REQ-W05)
- [ ] `should return outbound AI messages in GET messages` (REQ-W04) — seed AI message directly
- [ ] `DELETE should fail for session from another tenant` — tenant isolation (REQ-W05)

---

## T08 — Create Playwright widget-chat.spec.ts
**Where**: `src/app/e2e/widget-chat.spec.ts` (bug-hunting project)
**What**: Full UX flow tested via `page.route()` API mocking. Serves SDK from built file.
**Done when**: All 6 Playwright test scenarios pass.
**Gate**: `cd src/app && npx playwright test e2e/widget-chat.spec.ts --project=bug-hunting`

Tests:
- [ ] Widget renders greeting from config
- [ ] Visitor sends message → optimistic bubble in UI
- [ ] AI reply appears after polling (GET mocked to return reply on 2nd call)
- [ ] Page reload restores messages (session restored from localStorage)
- [ ] Restart button clears chat and shows fresh greeting
- [ ] New session after restart has empty message list

---

## Execution Order

```
T01 (contact fix)
  └─► T02 (realtime publish)
        └─► T07 (e2e tests expand) ←─ also needs T03
T03 (DELETE endpoint)
  └─► T07
T04 (SDK localStorage)
  └─► T05 (restart button)
        └─► T06 (polling)
              └─► T08 (Playwright)
```

T01, T03, T04 can start in parallel.
T07 needs T01 + T03.
T08 needs T04 + T05 + T06.
