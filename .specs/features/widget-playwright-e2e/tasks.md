# Widget Playwright E2E — Tasks

## Status: Complete

## Tasks

### T1 — widget-niche-commerce.spec.ts [P1]
**What**: Playwright tests for e-commerce checkout conversation flow via inline widget
**Where**: `src/app/e2e/bug-hunting/widget-niche-commerce.spec.ts`
**Patterns**: Follow `widget-inline.spec.ts` — use `setup()`, `openPanel()`, `waitForMsg()`, `typeAndSend()` helpers, `#_atai-inp`/`#_atai-snd` selectors
**Requirements**: WPET-01..05
**Done when**: Tests run in `bug-hunting` project, cover product inquiry → quantity → address → payment link, invalid quantity rejection, mid-flow restart

### T2 — widget-niche-scheduling.spec.ts [P1]
**What**: Playwright tests for scheduling/booking flow via widget — clinic (collectCpf), beauty salon, generic service
**Where**: `src/app/e2e/bug-hunting/widget-niche-scheduling.spec.ts`
**Patterns**: Same as T1. Use `CFG_CPF` config with `collectCpf: true`. Mock AI replies with booking confirmation text.
**Requirements**: WPET-06..08, WPET-20
**Done when**: Covers booking request → slot selection → confirmation. CPF collect flow. Unavailable slot reply.

### T3 — widget-niche-configs.spec.ts [P1]
**What**: Playwright tests verifying correct rendering for multiple business niche configs
**Where**: `src/app/e2e/bug-hunting/widget-niche-configs.spec.ts`
**Patterns**: Same as T1. Test visual rendering — colors, position, quick reply chips, greeting text per niche.
**Requirements**: WPET-09..11
**Done when**: Covers 4 niches: restaurant, clinic, beauty salon, e-commerce. Color, position, greeting, quick replies verified.

### T4 — widget-security.spec.ts [P1]
**What**: Playwright security tests — XSS injection, session IDOR, payload attacks
**Where**: `src/app/e2e/bug-hunting/widget-security.spec.ts`
**Patterns**: Same as T1 for XSS (browser-level). For IDOR: use Playwright `request` fixture to send HTTP directly (no browser UI needed). Mock or bypass widget for raw API calls.
**Requirements**: WPET-12..17
**Done when**: XSS payloads don't fire, IDOR returns 403/404, empty message not sent, SYSTEM type rejected

### T5 — widget-messaging-edge-cases.spec.ts [P2]
**What**: Playwright tests for messaging edge cases — emoji, unicode, newlines, multiline, AI escalation, malformed server responses
**Where**: `src/app/e2e/bug-hunting/widget-messaging-edge-cases.spec.ts`
**Patterns**: Same as T1. Mock server to return malformed JSON for resilience tests.
**Requirements**: WPET-18..19 + edge cases from spec
**Done when**: Emoji renders, accents render, newlines preserved, escalation message visible, malformed JSON doesn't crash widget

## Execution Order
T1 → T2 → T3 (parallel possible) → T4 → T5
