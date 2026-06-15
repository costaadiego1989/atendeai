---
target: src/app/src/modules/billing
total_score: 26
p0_count: 1
p1_count: 2
timestamp: 2026-06-03T15-22-08Z
slug: src-app-src-modules-billing
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Usage % + checkout spinner good; KPI %s have no color-coded threshold until 80% banner |
| 2 | Match System / Real World | 3 | Strong PT-BR domain copy; "Tokens IA" is jargon for SMB owners |
| 3 | User Control and Freedom | 3 | Cancel confirm + downgrade warning solid; no undo on scheduled plan transition |
| 4 | Consistency and Standards | 2 | Radius chaos (rounded-lg/xl/2xl/full mixed), two greens (emerald-* vs success), tracking values drift (0.25/0.28em) |
| 5 | Error Prevention | 3 | Cancel dialog + "sem reembolso" warning are good |
| 6 | Recognition Rather Than Recall | 3 | Comparison table + quota tooltips reduce recall |
| 7 | Flexibility and Efficiency | 2 | 3 independent cycle toggles with separate state; no keyboard affordances |
| 8 | Aesthetic and Minimalist Design | 2 | Page overloaded; glass-card everywhere; card-grid sameness |
| 9 | Error Recovery | 2 | Generic error state, no retry button, "contate o suporte" is not a link |
| 10 | Help and Documentation | 3 | Tooltips + advisor helper text are genuinely helpful |
| Total | | 26/40 | Competent but generic — mid-band |

## Anti-Patterns Verdict

LLM slop tells found:
1. Glassmorphism as default (absolute ban). KPICard + BillingUsageProgressCard hardcode glass-card.
2. Identical card grids (absolute ban). 4 KPICards + 3 progress cards, same skeleton, 7 near-identical tiles.
3. Hero-metric template echo in the KPI row.
4. Uppercase-tracking as decoration, inconsistent values (0.25em vs 0.28em).
5. Category-reflex (first-order): billing -> teal/emerald + green savings badges + Popular column.

Deterministic scan: unavailable. detect.mjs reported "bundled detector not found". All findings manual.
Visual overlays: none. Source-dir target, no live server.

## Overall Impression
Solid IA, good PT-BR microcopy, real care in high-stakes flows (cancel, downgrade, checkout-waiting). But surface is visually undifferentiated: glass + uppercase + rounded-2xl + teal repeated until every section reads the same weight. Biggest opportunity: break card-grid sameness and kill cycle-toggle triplication.

## What's Working
1. High-stakes flows have real reassurance (cancel consequences, downgrade no-refund warning, checkout escape hatch).
2. Quota tooltips on the comparison table reduce recall.
3. Domain copy speaks the operator's language.

## Priority Issues

[P1] Three independent billing-cycle toggles, three separate states. BillingUsagePage owns selectedCycle, PricingComparisonTable owns its own billingCycle, advisor reads page state. Table "Anual" vs recommendation "Mensal" contradict on a money decision. Fix: lift cycle to one source, controlled prop; delete table's internal useState. Command: harden.

[P0] Diacritic/encoding bugs. BillingUsagePage:168 "sera" (sera->sera/will-be missing accent), :176 "Proximo ciclo". Broken PT on a paid screen. Systemic (matches commit 3a49f31). Fix: sweep module for missing accents, verify UTF-8. Command: clarify.

[P1] Glassmorphism + card-grid sameness flatten hierarchy. 7 glass tiles at identical weight, no entry point. Fix: drop glass-card, flat tinted surfaces; differentiate KPIs from usage bars; let comparison table be the peak. Command: distill then layout.

[P2] Error state is a dead end. Generic EmptyState, no retry, no support link. Fix: add "Tentar novamente" wired to refetch; make suporte a link. Command: harden.

[P2] Radius + color-token inconsistency. 4 radii + two greens (emerald-* vs success). Fix: 2-step radius scale; route positive color through success token. Command: extract then polish.

## Persona Red Flags
Marina (SMB owner/payer): "Tokens IA" means nothing; triple toggle desync makes her doubt the price; 7 same cards give no "what do I do" signal.
Alex (power user/agency): no keyboard path; change-plan is several clicks deep (table -> sheet -> confirm).
Jordan (first-timer/TRIAL): lands with zero usage into an 8-section active-operation wall; no first-run framing.

## Minor Observations
- hasFeature inferred by sortOrder cascade; fragile if sortOrder null.
- min-w-[800px] table forces mobile horizontal scroll, no sticky plan header.
- PublicPlansTeaser is the one restrained component; use as reference.
- animate-ping + animate-spin stacked in checkout sheet is excess motion.

## Questions to Consider
- Advisor and comparison table both recommend a plan. Need both?
- What if usage bars turned alarming inline at 80% instead of a separate banner?
- Trial users see the operator dashboard. What would a first-run version look like?
