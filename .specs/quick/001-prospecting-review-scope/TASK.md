# Quick task: Prospecting module review — implementation scope

## One-line goal

Align `MODULE-prospecting.md` with TLC spec-driven workflow by **recording** what must not be built automatically (melhorias/features), without changing prospecting runtime code.

## Files touched

- `docs/api-modules-review/MODULE-prospecting.md` — add explicit implementation scope section
- `.specs/project/STATE.md` — decision PROSPECTING-001
- `.specs/quick/001-prospecting-review-scope/TASK.md` (this file)
- `.specs/quick/001-prospecting-review-scope/SUMMARY.md`

## Approach

Documentation and persistent memory only; zero changes under `src/api/modules/prospecting` for deferred bullets.

## Done when

- [x] MODULE doc lists out-of-scope items for this cycle
- [x] STATE.md records the decision
- [x] SUMMARY.md closes the quick task

## Verify

No grep-needed code requirement; confirm files exist and wording matches stakeholder intent (no melhorias/features implementation).
