# Widget Playwright E2E Test Suite — Specification

## Problem Statement

The chat widget is the primary revenue-generating surface for AtendeAi tenants. Current Playwright coverage tests only the basic SDK/inline widget UX (open/close/send/receive/collect). No tests cover multi-niche conversation flows (commerce checkout, scheduling booking), security vulnerabilities (XSS, IDOR, session hijacking, injection), or messaging edge cases. Bugs in these areas go undetected until production.

## Goals

- [ ] Cover commerce checkout conversation flow via widget (AI-driven steps)
- [ ] Cover scheduling booking conversation flow via widget
- [ ] Cover multi-niche business configs (clinic, beauty salon, restaurant, e-commerce store)
- [ ] Expose security vulnerabilities in widget messaging endpoints
- [ ] Cover messaging edge cases: unicode, empty, oversized, AI escalation, rate limiting

## Out of Scope

| Feature | Reason |
|---|---|
| Real AI responses | Use mocked AI replies; testing AI quality is separate |
| Payment gateway UI | Payment redirect tested at API level only |
| Backend NestJS e2e | Already covered in `widget.e2e-spec.ts` |
| Mobile/responsive | Out of scope for this iteration |

---

## User Stories

### P1: Commerce Checkout via Chat ⭐ MVP

**User Story**: As a visitor on an e-commerce widget, I want to browse products and complete a purchase entirely via chat so that I never leave the chat window.

**Why P1**: Commerce is the primary paid feature. No end-to-end test covers the widget→checkout path.

**Acceptance Criteria**:

1. WHEN visitor asks about a product THEN widget SHALL show AI reply with product details
2. WHEN AI presents quantity question THEN visitor SHALL be able to send a number and advance the flow
3. WHEN AI asks for delivery address THEN visitor SHALL send address text and advance
4. WHEN checkout reaches payment step THEN widget SHALL render payment link message
5. WHEN visitor sends invalid quantity (letters) THEN AI SHALL re-ask for valid input
6. WHEN visitor abandons mid-flow and restarts THEN widget SHALL start a new session cleanly

**Independent Test**: Load widget with commerce config, mock AI responses returning each step message, verify visitor can type through all steps.

---

### P1: Scheduling Booking via Chat ⭐ MVP

**User Story**: As a visitor on a scheduling-enabled widget (clinic, beauty salon), I want to book an appointment via chat so that I get confirmed without calling.

**Why P1**: Scheduling is the #2 paid module. No Playwright test covers booking flow.

**Acceptance Criteria**:

1. WHEN visitor asks to book THEN widget SHALL show available services
2. WHEN AI returns date/time options THEN visitor can select and confirm
3. WHEN booking confirmed THEN widget SHALL show confirmation message with date/time
4. WHEN selected slot is unavailable THEN widget SHALL show alternative slots
5. WHEN visitor provides CPF for medical niche THEN collectCpf flow SHALL work end-to-end

**Independent Test**: Load widget with clinic config (collectCpf: true), mock AI scheduling replies, verify booking confirmation appears.

---

### P1: Multi-Niche Configuration Rendering ⭐ MVP

**User Story**: As a tenant from different business niches, my widget SHALL display correctly branded and configured for my niche.

**Acceptance Criteria**:

1. WHEN config has custom color THEN FAB and send button SHALL render with that color
2. WHEN config has greeting for restaurant niche THEN greeting message SHALL appear verbatim
3. WHEN config has quick replies for clinic THEN chips SHALL show correct labels
4. WHEN config has no avatar THEN placeholder SHALL render without broken image
5. WHEN widget position is bottom-left THEN FAB SHALL be positioned on left side

**Independent Test**: Load widget with each niche config, open panel, verify rendered elements.

---

### P1: Security — XSS Injection Prevention ⭐ MVP

**User Story**: As a security auditor, I want to verify that script injection via chat messages does NOT execute in the widget.

**Why P1**: XSS in a chat widget affects ALL tenants' visitors. Critical vulnerability.

**Acceptance Criteria**:

1. WHEN visitor sends `<script>alert(1)</script>` as message THEN widget SHALL render it as text, not execute JS
2. WHEN AI reply contains `<img onerror="alert(1)" src="x">` THEN widget SHALL NOT execute the handler
3. WHEN visitor name contains `<script>` THEN collected name SHALL be escaped before rendering
4. WHEN message text contains `javascript:` protocol links THEN they SHALL NOT be rendered as clickable links
5. WHEN message contains HTML entities THEN they SHALL render as plain text

**Independent Test**: Send XSS payloads, verify `window._xss_fired` remains undefined.

---

### P1: Security — Session IDOR ⭐ MVP

**User Story**: As a security auditor, I want to verify that visitor A cannot read messages from visitor B's session.

**Acceptance Criteria**:

1. WHEN visitor sends GET messages with another visitor's sessionId THEN API SHALL return 404 or 403
2. WHEN visitor sends DELETE to another session THEN API SHALL reject (404/403)
3. WHEN sessionId is a valid UUID but belongs to different tenant THEN API SHALL reject

**Independent Test**: Mock two sessions, attempt cross-session reads, verify rejection.

---

### P2: Security — Payload Injection & Limits

**Acceptance Criteria**:

1. WHEN message text is empty string THEN widget SHALL NOT send request (button stays disabled or input is rejected)
2. WHEN message text is 10,000 characters THEN widget SHALL either truncate or show error
3. WHEN message contains only whitespace THEN widget SHALL treat as empty
4. WHEN visitorId is injected with SQL chars (`'; DROP TABLE`) THEN API SHALL sanitize
5. WHEN `type` field is set to `SYSTEM` THEN backend SHALL reject or ignore privilege escalation

**Independent Test**: Attempt each payload via mocked/live API, verify no 500 errors or data corruption.

---

### P2: AI Escalation Flow (Human Handoff)

**Acceptance Criteria**:

1. WHEN visitor sends "quero falar com humano" THEN widget SHALL display escalation message
2. WHEN AI escalation is triggered THEN conversation status SHALL change to PENDING_HUMAN
3. WHEN AI replies with escalation indicator THEN widget SHALL render it visually differently (or as plain message)

---

### P2: Messaging Edge Cases

**Acceptance Criteria**:

1. WHEN message contains emoji (🎉🛒💇‍♀️) THEN it SHALL render correctly without corruption
2. WHEN message contains accented Portuguese text THEN it SHALL render correctly
3. WHEN message contains newlines THEN they SHALL be preserved in bubble
4. WHEN network drops mid-send THEN widget SHALL show error state (existing test covers this — extend for niche context)
5. WHEN widget is opened on page with CSP headers THEN it SHALL degrade gracefully

---

## Edge Cases

- WHEN publicToken is unknown (404 from config) THEN widget SHALL not render at all
- WHEN session POST returns 503 THEN widget SHALL render but show degraded state
- WHEN messages endpoint returns malformed JSON THEN widget SHALL not crash
- WHEN visitor refreshes page mid-conversation THEN session SHALL restore from localStorage
- WHEN two tabs open same widget THEN both SHALL share same visitorId (localStorage)

---

## Requirement Traceability

| Requirement ID | Story | Status |
|---|---|---|
| WPET-01 | Commerce checkout — product inquiry | Pending |
| WPET-02 | Commerce checkout — quantity step | Pending |
| WPET-03 | Commerce checkout — address step | Pending |
| WPET-04 | Commerce checkout — payment link | Pending |
| WPET-05 | Commerce checkout — invalid input handling | Pending |
| WPET-06 | Scheduling — booking request | Pending |
| WPET-07 | Scheduling — confirmation message | Pending |
| WPET-08 | Scheduling — collectCpf flow (medical niche) | Pending |
| WPET-09 | Multi-niche — color branding | Pending |
| WPET-10 | Multi-niche — quick replies per niche | Pending |
| WPET-11 | Multi-niche — bottom-left position | Pending |
| WPET-12 | Security — XSS script tag injection | Pending |
| WPET-13 | Security — XSS img onerror injection | Pending |
| WPET-14 | Security — session IDOR (cross-visitor read) | Pending |
| WPET-15 | Security — empty message prevention | Pending |
| WPET-16 | Security — oversized message | Pending |
| WPET-17 | Security — SYSTEM type injection | Pending |
| WPET-18 | AI escalation flow | Pending |
| WPET-19 | Emoji/unicode rendering | Pending |
| WPET-20 | CPF collection — medical niche | Pending |

## Success Criteria

- [ ] All 5 new test files pass in `bug-hunting` Playwright project
- [ ] At least 3 security bugs discovered or confirmed mitigated
- [ ] Commerce and scheduling flows have full step-by-step coverage
- [ ] Zero false positives (tests fail only on real bugs)
