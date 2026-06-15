---
target: src/app/src/modules/catalog
total_score: 22
p0_count: 0
p1_count: 3
timestamp: 2026-06-03T15-46-48Z
slug: src-app-src-modules-catalog
---
# Catalog Module — Design Critique

Assessment independence: degraded (sequential manual review). Deterministic scan: unavailable (detect.mjs bundled module missing). Browser overlay: not run.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading is plain text not skeleton; async panel good |
| 2 | Match System / Real World | 2 | Broken PT-BR diacritics: catalogo, serviços (lc), saira, sera, deixara |
| 3 | User Control and Freedom | 3 | Delete confirms explain blocking; show/hide inactive |
| 4 | Consistency and Standards | 1 | Type filter duplicated two affordances; mixed radii; glass vs plain cards |
| 5 | Error Prevention | 3 | Destructive dialogs explain consequences |
| 6 | Recognition Rather Than Recall | 3 | Clear labels, icon+text tabs |
| 7 | Flexibility and Efficiency | 2 | No keyboard affordances; duplicate filters |
| 8 | Aesthetic and Minimalist Design | 2 | Glass everywhere; Readiness static filler; 5 radii |
| 9 | Error Recovery | 2 | No error state on table/loading paths |
| 10 | Help and Documentation | 2 | page-description teaches; no contextual help |
| Total | | 22/40 | Below average — structural consistency problems |

## Anti-Patterns Verdict

Partly AI-generated feel. Trips product slop test. Biggest tell: same type filter rendered twice with two different controls (segmented buttons + Select), both wired to vm.typeFilter.

Absolute-ban hits:
- Glassmorphism as default (BAN): .glass-card = bg-card/70 backdrop-blur-md rounded-3xl is the page-wide surface. Filter card double-stacks it.
- Identical card grids (BAN-adjacent): CategoriesTab and ReadinessTab both grid lg:grid-cols-3 same cards. ReadinessTab = static text filler.

Deterministic scan unavailable; findings high-confidence from source, untooled.

## Overall Impression

Structure sound (header -> async panel -> filter -> KPIs -> tabs). Empty states + delete confirmations good. Surface over-decorated (blur everywhere) and inconsistent with itself. Biggest opportunity: kill duplication, standardize component vocabulary.

## What's Working

1. EmptyState + destructive-action dialogs — teach the interface, explain why deletes block.
2. AsyncOperationsPanel — right reassurance for background jobs.
3. KPICard restraint — only component respecting Restrained color floor.

## Priority Issues

[P1] Type filter duplicated with two affordances. Two controls mutate same typeFilter -> ambiguity + redundant chrome. Fix: keep segmented control, delete Select (or remove the Relatório filter card entirely). Command: distill.

[P1] Glassmorphism is the page default. backdrop-blur-md on every container, decorative, ban. Fix: flat panel bg-card border rounded-xl; reserve blur for overlays. Command: quieter.

[P1] Broken PT-BR diacritics. catalogo, serviços (lc title), saira, sera, deixara. Reads unfinished to BR operator. Fix: catálogo, Serviços, sairá, será, deixará. Command: clarify.

[P2] Loading is text not skeleton. Render skeleton matching layout. Command: harden.

[P2] Inconsistent radii + weight noise. 5 radius values + font-bold on all chrome. Standardize to two radii; drop font-bold. Command: polish.

## Persona Red Flags

Alex (Power User): no keyboard shortcuts; primary action only in header; duplicate filter ambiguity.
Jordan (First-Timer): three bands of chrome before content; Readiness tab has no action.
Beatriz (SMB owner BR): lowercase/missing accents read as bug; cramped dual filters on mobile.

## Minor Observations

- items: any[] / category: any — type-safety gap lets malformed data hit UI.
- Row cursor-pointer, no keyboard activation.
- Two placeholder phrasings (Sem descrição comercial vs operacional).
- Readiness copy reads like marketing inside a tool.

## Questions to Consider

- Remove the Relatório filter card entirely — what is lost besides a dup filter?
- Does Readiness need to be a tab or a one-time tooltip?
- What would a flat zero-blur version look like?
