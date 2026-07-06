# Widget Quick Replies

## Context

Widget visitors currently see an open text input with no guidance on what they can ask. When AI doesn't respond (timeout) or when operators want to guide visitors to specific topics, there's no mechanism. This feature adds configurable tap-to-send chips that appear after the greeting and re-appear on fallback.

## Requirements

### REQ-WQR-01 — Storage
`WidgetConfig` adds `quickReplies Json @default("[]")` storing an ordered array of strings (max 8 items, max 80 chars each). Validation enforced at the use-case layer.

### REQ-WQR-02 — Config Endpoint
`GET /widget/:publicToken/config` includes `quickReplies: string[]` in the response payload. Empty array means chips are not shown.

### REQ-WQR-03 — Widget Display
After the greeting message finishes typing (or after collect flow completes in collect mode), render quick reply chips in a horizontally scrollable row above the footer. Chips are rendered only when `quickReplies.length > 0`.

### REQ-WQR-04 — Chip Interaction
Tapping a chip sends its text as a visitor message (equivalent to typing and pressing Enter). Chips disappear permanently after one is tapped OR after the visitor manually types and sends their first free-text message.

### REQ-WQR-05 — Fallback Re-show
When the 25s typing timeout fires, after the fallback message, re-render any remaining chips so the visitor has quick options available.

### REQ-WQR-06 — Settings UI
`WidgetSettingsPage` adds a "Respostas rápidas" section where operators can add/remove chip labels (tag-input pattern). Max 8 items enforced in UI. Order preserved.

### REQ-WQR-07 — Persistence
`UpdateWidgetConfigUseCase` accepts `quickReplies?: string[]` and validates length constraints. Prisma migration required.

## Out of Scope
- Localisation of chip labels
- Analytics on which chip was tapped
- Dynamic AI-suggested chips

## Files to Touch

| File | Change |
|---|---|
| `src/api/prisma/schema.prisma` | Add `quickReplies Json @default("[]")` to `WidgetConfig` |
| `src/api/prisma/migrations/` | New migration |
| `src/api/modules/messaging/application/use-cases/UpdateWidgetConfigUseCase.ts` | Accept + validate `quickReplies` |
| `src/api/modules/messaging/presentation/controllers/WidgetController.ts` | Include `quickReplies` in config response |
| `src/api/modules/messaging/presentation/controllers/WidgetScriptController.ts` | Render chips, handle tap, re-show on fallback |
| `src/web/src/modules/messaging/pages/WidgetSettingsPage.tsx` (or similar) | Tag-input UI for quick replies |

## Acceptance Criteria

- [ ] Empty `quickReplies` → no chips rendered, widget unchanged
- [ ] Chips appear after greeting typewriter finishes
- [ ] Tapping chip sends text and chips disappear
- [ ] Manual send also removes chips
- [ ] 25s timeout → fallback message + chips re-appear
- [ ] Settings UI saves up to 8 chips
- [ ] Migration runs cleanly on prod (default `[]` — no backfill needed)
