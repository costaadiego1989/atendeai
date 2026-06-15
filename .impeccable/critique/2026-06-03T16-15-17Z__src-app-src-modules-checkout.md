---
target: checkout module
total_score: 23
p0_count: 0
p1_count: 5
timestamp: 2026-06-03T16-15-17Z
slug: src-app-src-modules-checkout
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Pulsing-text loaders, not skeletons |
| 2 | Match System / Real World | 3 | PT-BR labels ship without accents |
| 3 | User Control and Freedom | 2 | No undo on order status moves |
| 4 | Consistency and Standards | 2 | Mixed radii, weights, color tokens; side-stripe |
| 5 | Error Prevention | 1 | Destructive "Cancelar" fires on one click, no confirm |
| 6 | Recognition Rather Than Recall | 3 | Kanban + icons label state well |
| 7 | Flexibility and Efficiency | 3 | Drag-drop AND buttons; tabs |
| 8 | Aesthetic and Minimalist Design | 2 | Glass, glows, side-stripe, badge soup |
| 9 | Error Recovery | 1 | Mutation failures never surfaced in UI |
| 10 | Help and Documentation | 3 | Card descriptions + teaching empty states |
| **Total** | | **23/40** | **Below average — fixable without redesign** |

## Anti-Patterns Verdict

**LLM assessment:** Reads partly AI-generated. Three tells: the `border-l-4 border-l-primary/50` side-stripe on order cards (banned), `glass-card` + transparency layering used decoratively across every surface (banned), and a hardcoded emerald glow `shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]`. Plus label noise: nearly every label is 9-11px uppercase tracking-widest bold, so emphasis is flat.

**Deterministic scan:** Unavailable — bundled detector crashed (`bundled detector not found`) after a real attempt. Findings are manual-only.

**Visual overlays:** None. No browser automation in session.

## Overall Impression
Functionally rich operational board (Kanban + drag-drop + buttons + sheets), undermined by decorative styling and one real safety gap: cancelling an order is a single unconfirmed click with no undo and no error surface. Biggest opportunity: strip the banned decoration, fix BR copy, and protect the destructive transition.

## What's Working
- **Dual interaction model** on the order board: drag-drop for power users, explicit status buttons for discoverability (`CheckoutOrdersMesa` 245-273). Genuinely good.
- **Teaching empty states** via shared `EmptyState` on board, products, customers.
- **Per-status action maps** (`STATUS_ACTIONS`) keep the workflow legible and constrained per stage.

## Priority Issues

- **[P1] Banned side-stripe border** on order cards (`CheckoutOrdersMesa.tsx:180`). Status already carried by a Badge; the colored left edge is pure AI-slop. **Fix:** full border, drop the stripe. **Command:** distill
- **[P1] Decorative glassmorphism** (`glass-card` + `bg-background/30|20|40` + backdrop-blur across CheckoutPage / DetailsSheet / AnalyticsTabs). **Fix:** solid tokenized surfaces, one neutral panel layer, no blur. **Command:** quieter
- **[P1] PT-BR diacritics missing** (`preparacao`, `producao`, `separacao`, `Operacao`, `expedicao`, `concluido`, `avancarem`, `aparecerao`, `Ultima`, `Regua`; casing `cobrança`). Reads broken to a Brazilian operator. **Fix:** correct accents/casing, centralize in `checkout-ui-utils.ts`. **Command:** clarify
- **[P1] No confirm on destructive status move** (`onMoveOrderStatus` -> `CANCELLED`, one click, no undo). **Fix:** confirm dialog for cancel; undo toast for forward moves. **Command:** harden
- **[P1] Mutation errors never surfaced.** Status-move failure is silent. **Fix:** error toast + keep card in prior column. **Command:** harden

## Persona Red Flags

**Sofia (Operator / Busy Power User):** Drag-drops an order to "Cancelado" by accident — gone, no undo, no confirm. If the API rejects a move, the board lies (no error). 9-11px labels strain a glance read on a busy day.

**Marcos (Owner / First-Timer):** Opens an order with no parsed items and sees a blank gap under "Itens do pedido" (no empty state). Mixed Title-case / lowercase labels (`Cobrança` vs `cobrança`) and missing accents read as half-finished.

## Minor Observations
- Order card badge soup: up to 5 pills wrap into noise (`CheckoutOrdersMesa` 215-232).
- Cart rows are bordered cards inside a card inside a sheet (nested cards).
- Mixed radii on the same surfaces (`rounded-md|lg|xl|2xl|full`).
- `animate-pulse` text loaders instead of skeletons (product register).

## Questions to Consider
- Should cancelling an order ever be a single click, or always confirmed?
- Does the board need glass at all, or is a solid neutral panel calmer and faster to scan?
- Is the 5-badge order card giving information or just visual weight?
