# Widget Chat Integration Fix — Spec

## Overview
The embed widget chat has 6 interconnected failures that break the end-to-end experience: session persistence, contact creation, AI responses, app visibility, restart UX, and event bus wiring. This spec covers full diagnosis and remediation with passing integration tests and Playwright e2e tests.

---

## Requirements

### REQ-W01 — Session Persistence
The widget must persist the visitor session across page reloads.
- `sessionId` MUST be saved to `localStorage` with key `atendeai_session_${publicToken}` after every successful `/sessions` call.
- On init, SDK MUST attempt to restore `sessionId` from localStorage before calling `/sessions`.
- If stored `sessionId` is invalid (404 from server), SDK clears localStorage and creates new session.
- Backend already resumes by `visitorId` — backend behavior unchanged.

### REQ-W02 — Contact Creation in System
Every widget visitor MUST be created as a `Contact` in the tenant's CRM.
- `InitiateWidgetContactUseCase` calls `contactFacade.ensureContact()` with phone = `widget_${visitorId}` when no real phone is given.
- `IdentifyContactUseCase` MUST NOT reject this synthetic phone — it must be treated as a valid identifier.
- Fix: set `source: 'widget'` on contact creation to bypass strict phone format validation, OR ensure `IdentifyContactUseCase` accepts non-numeric phones for `LEAD` stage.
- After fix: contact row exists in DB for every widget session init.

### REQ-W03 — Messages Visible in Internal App Chat
Widget inbound messages MUST appear as conversations in the internal app.
- `ProcessWidgetMessageUseCase` publishes `MessageReceivedIntegrationEvent` ✅ (already done).
- The internal app's conversations list MUST show `channel: 'WEB_CHAT'` conversations.
- `IMessagingRealtimePublisher.publish()` MUST be called with `message.received` event after widget message is saved, so the internal WebSocket subscribers are notified in real-time.
- Add realtime publish call to `ProcessWidgetMessageUseCase` after DB write.

### REQ-W04 — Agentic AI Responds to Widget Messages
The AI MUST generate and persist a reply for every widget inbound message.
- `MessageReceivedIntegrationEvent` (queue: `messaging.message-received`) triggers `MessageReceivedHandler` (AI module) → `ProcessAIResponseUseCase`.
- `ProcessAIResponseUseCase` uses `moduleId: 'widget'` to look up agent rule → falls back to `messaging` rule if no `widget` rule configured.
- **Root cause blocker**: `ProcessAIResponseService.runPipeline()` returns early with `NO_SUBSCRIPTION` if tenant has no active plan. E2E tests must seed tenant with active AI quota OR mock the quota check.
- `SendAIMessageUseCase` saves the AI reply as `sentBy: 'AI', direction: 'OUTBOUND'`.
- Widget polling fetches this via `GET /sessions/:id/messages` and displays it.

### REQ-W05 — Restart Conversation ("Voltar ao início")
The visitor MUST be able to restart the chat from the beginning.
- New backend endpoint: `DELETE /api/v1/widget/:publicToken/sessions/:sessionId`
  - Validates session belongs to the publicToken's tenant.
  - Sets `WidgetSession.status = 'CLOSED'`.
  - Sets linked `Conversation.status = 'ARCHIVED'`.
  - Returns `{ success: true }`.
- SDK adds "Reiniciar conversa" button in widget header (secondary action, small icon or link).
- On click: calls DELETE endpoint, clears `localStorage` session key, re-initializes widget (new session, new conversation, AI sends welcome again).

### REQ-W06 — Event Bus Integration Verified
The outbox → BullMQ → handler pipeline MUST work for widget messages.
- `PrismaTransactionalEventPublisher` writes events to outbox table after DB commit.
- `OutboxDispatcher` (polling) picks up and publishes to BullMQ queue `messaging.message-received`.
- `MessageReceivedHandler` (AI module) processes and calls AI pipeline.
- In e2e tests: events are tested by verifying DB state (contact created, message created, conversation created) rather than requiring live BullMQ/Redis.
- Unit tests mock the event publisher and verify `publish()` was called with correct payload.

### REQ-W07 — Playwright E2E Tests
Full widget UX MUST be tested with Playwright covering each step of the flow.
- Tests live in `src/app/e2e/widget-chat.spec.ts` (bug-hunting project, no auth needed).
- Widget is served via real API + `page.route()` mock for AI responses.

---

## Test Coverage Required

### Integration Tests (Jest e2e) — `widget.e2e-spec.ts` expansions
| Test | Validates |
|------|-----------|
| Contact created in DB after `POST /sessions` | REQ-W02 |
| Session resume returns same `sessionId` and loads messages | REQ-W01 |
| `DELETE /sessions/:id` archives session + conversation | REQ-W05 |
| After restart, new session creates new conversation | REQ-W05 |
| Inbound message creates DB message with correct direction | REQ-W03 |
| Outbound AI message appears in `GET /sessions/:id/messages` | REQ-W04 |
| Tenant isolation on DELETE endpoint | REQ-W05 |

### Playwright Tests — `src/app/e2e/widget-chat.spec.ts`
| Test | Step |
|------|------|
| Widget loads and renders greeting | Load widget |
| Visitor sends message, optimistic bubble appears | Send message |
| AI reply appears after polling (mocked response) | AI response |
| Session persists across page reload (messages load) | Persistence |
| "Reiniciar conversa" button resets chat to initial state | Restart |
| New session after restart has empty message list | Restart |

---

## Out of Scope
- WebSocket real-time delivery to widget (polling is acceptable for this fix).
- Multi-agent branching in widget.
- File/image uploads in widget.
- WhatsApp/Instagram channel fixes.
