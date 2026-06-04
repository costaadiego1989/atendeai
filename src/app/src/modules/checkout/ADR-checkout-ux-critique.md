# ADR-001 — Checkout module UX/UI remediation

- **Status:** Proposed
- **Date:** 2026-06-03
- **Module:** `src/app/src/modules/checkout`
- **Register:** Product (dashboard UI serving an operational task)
- **Source:** `/impeccable critique` design review (Assessment A manual; Assessment B detector unavailable — bundle missing)

---

## Context

The checkout module is the operator-facing surface for conversational-commerce orders:
report header, logistics strategy cards, KPIs, operational funnel, an order
Kanban/list board, a revenue chart, commercial-intelligence rankings, and several
config sheets. The order-item ("cart") lists are the operational core.

### Where the item / cart lists live

| List | File | Lines | What it shows |
|---|---|---|---|
| **Order items (the cart)** | `components/CheckoutDetailsSheet.tsx` | **199–216** | Per-line `name`, `quantity` x `unitPrice`, `lineTotal`. The true cart contents. |
| Order totals (subtotal/frete/total) | `components/CheckoutDetailsSheet.tsx` | 218–235 | Summary for the cart above. |
| Order cards (order-level board) | `components/CheckoutOrdersMesa.tsx` | 166–276 | Kanban + grid of orders. `renderOrderCard`. |
| Kanban columns | `components/CheckoutOrdersMesa.tsx` | 320–373 | 6 status columns, drag-drop. |
| Customer ranking list | `components/CheckoutAnalyticsTabs.tsx` | 135–165 | Ranked customers. |
| Product ranking | `components/CheckoutAnalyticsTabs.tsx` | 84–124 | Horizontal bar chart (not a list). |
| Operational funnel | `views/CheckoutPage.tsx` | 132–143 | Shared `DynamicFunnel`. |

The critique scored the surface **23/40** (Nielsen). Below are the decisions to
raise correctness, consistency, and trust without redesigning the IA.

---

## Decisions

### D1 — Remove the banned side-stripe border on order cards (P1)
`CheckoutOrdersMesa.tsx:180` uses `border-l-4 border-l-primary/50`. Side-stripe
accent borders are a hard ban (AI-slop tell). Decision: drop the left stripe; use a
full `border-border/60` and convey status through the existing status `Badge` and
`getOrderTone`, not a colored edge.

### D2 — Drop decorative glassmorphism (P1)
`glass-card` + `bg-background/30|20|40` transparency layering and `backdrop-blur`
(`CheckoutPage` 34/67/109, `CheckoutDetailsSheet` 133/169/341, `CheckoutAnalyticsTabs` 61)
are decorative glass, a hard ban. Decision: replace with solid tokenized surfaces
(`bg-card` / `bg-background` + `border-border`). Keep one neutral panel layer for
the board per the product register, no blur.

### D3 — Fix PT-BR diacritics (P1, Brazil product)
Multiple labels ship without accents, which reads as broken to a BR operator:
- `CheckoutOrdersMesa.tsx`: `preparacao`→`preparação`, `producao`→`produção`,
  `separacao`→`separação`, `Operacao`→`Operação`, `expedicao`→`expedição`,
  `concluido`→`concluído`, `avancarem`→`avançarem`, `aparecerao`→`aparecerão`,
  `Ultima`→`Última`.
- `CheckoutDetailsSheet.tsx`: `Regua de abandono`→`Régua de abandono`.
- Casing: stage label `cobrança` is lowercase (`CheckoutDetailsSheet.tsx:139`, 242)
  while sibling labels are Title Case. Normalize to `Cobrança`.

Decision: correct all diacritics and casing. Centralize repeated labels in
`view-models/checkout-ui-utils.ts` so copy lives in one place.

### D4 — Add destructive-action confirmation (P1, error prevention)
Order status moves (`onMoveOrderStatus`) fire on a single click, including
`Cancelar` (`variant:'destructive'`), with no confirm and no undo. Cancelling an
order is hard to reverse. Decision: gate destructive transitions (`CANCELLED`)
behind a confirm dialog; optionally a toast with undo window for forward moves.

### D5 — Surface mutation errors (P1, error recovery)
`updateOrderStatusMutation` failures are not shown in the UI. Decision: on
mutation error, show a toast/inline error and keep the card in its prior column
(no silent revert). Loading is already handled via `movingOrderId`.

### D6 — Empty + loading states for the cart item list (P2)
`CheckoutDetailsSheet.tsx:200` maps `session?.items` with no empty branch: an order
with zero parsed items renders a blank gap under "Itens do pedido". Decision: add a
"Sem itens neste checkout" empty row. Replace `animate-pulse` text loaders
(DetailsSheet 109, OrdersMesa 311) with skeletons (product register: skeletons, not
pulsing text).

### D7 — Flatten typographic noise (P2)
`text-[9px]`/`[10px]`/`[11px]` + `uppercase tracking-widest` + `font-bold` are
applied to nearly every label, so nothing is actually emphasized and 9px fails
legibility. Decision: establish a small fixed scale (`text-xs` floor for labels,
`text-[10px]` only for true micro-metadata), reserve `font-bold`/`font-semibold` for
genuine hierarchy, cut most `uppercase tracking-widest`.

### D8 — Unify radii and color tokens (P2, consistency)
Same surfaces mix `rounded-md|lg|xl|2xl|full`. Decision: standardize to two radii
(`rounded-lg` controls/cards, `rounded-full` pills only). Replace the hardcoded glow
`shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]` (DetailsSheet 149) and raw
`amber-300/500` (abandonment) with semantic tokens (`--warning`, ring utilities).

### D9 — Reduce order-card badge soup (P3)
`renderOrderCard` can show 5 badges (status + fulfillment + shipping + payment +
abandonment), wrapping into noise. Decision: keep status (top) + payment; fold
fulfillment/shipping into one line of plain muted text; keep abandonment only when
`count > 0`.

### D10 — Distill nested cart rows (P3)
Cart rows (`DetailsSheet` 201–214) are bordered cards inside a card inside a sheet
(nested cards, discouraged). Decision: render rows as a plain divided list
(`divide-y border-border/40`), not individual bordered cards.

---

## Scope / Non-goals

- No change to view-model data contracts, queries, or `checkout-service.ts` behavior.
- No IA restructure: Kanban, tabs, sheets, and funnel stay.
- No backend / Prisma / tenant changes. Pure presentation layer.

## Consequences

- **Positive:** removes 2 hard-ban anti-patterns, fixes BR-facing copy, closes an
  error-prevention gap on a destructive op, improves legibility and consistency.
- **Cost:** touches every component file in the module (presentation only); needs a
  component-test pass for the new confirm dialog and empty/error states.
- **Risk:** destructive-confirm (D4) changes an interaction flow; cover with a test.

## Implementation order

1. P1: D3 (copy) → D1 (stripe) → D2 (glass) → D4 (confirm) → D5 (errors).
2. P2: D6 (states) → D7 (type) → D8 (tokens/radii).
3. P3: D9 (badges) → D10 (rows).
4. Verify: `cd src/app && npm run lint && npm run build`; add tests for D4/D5/D6.

## Traceability

Critique snapshot: `.impeccable/critique/` (slug `src-app-src-modules-checkout`).
