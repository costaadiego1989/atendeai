# Matriz de testes por módulo (API)

Este ficheiro no monorepo aponta para as **especificações de teste** vivas no repositório da API (`src/api`), commitadas junto ao código executável.

## Onde está o detalhe

- **Índice:** [src/api/docs/testing/MODULE-TEST-SPEC-INDEX.md](../../src/api/docs/testing/MODULE-TEST-SPEC-INDEX.md)
- **Por módulo:** `src/api/modules/<módulo>/TEST-SPEC.md`

## Resumo de escala (aprox., 2026-05)

| Módulo | Ficheiros `*.spec.ts` + `*.e2e-spec.ts` (aprox.) | Nota de risco |
|--------|---------------------------------------------------|---------------|
| tenant | ~57 | Cobertura alta; foco em tempo de CI e race conditions. |
| prospecting | ~35 | Forte em unit; validar smoke worker/CI. |
| messaging | ~28 | Golden files webhooks recomendados. |
| billing | ~17 | Reforçar concorrência em quotas. |
| contact | ~14 | Bastante coberto. |
| sales | ~14 | Relatórios e decimais. |
| recovery | ~12 | Templates e injeção. |
| auth | ~12 | Cookies/CSRF/rate limit. |
| payment | ~11 | Idempotência webhook. |
| commerce | ~10 | Sessão concorrente. |
| scheduling | ~8 | Mock Google para CI. |
| ai | ~19 | Falhas adapter e safety. |
| alerts | ~4 | Fila/cron e2e. |
| agent-rules | ~3 | AuthZ REST. |
| social | ~3 | E2E Meta sugerido. |
| platform-admin | ~4 | **P0:** matriz papel/IDOR. |
| support | ~2 | **P0:** e2e + paginação. |
| catalog | ~1 | **P0:** unit além do e2e. |
| inventory | ~3 (inclui 2 unit novos + e2e) | Integrações HTTP mock; DTO vs factory. |

## Relação com `MODULE-*.md`

Os ficheiros `MODULE-<módulo>.md` nesta pasta descrevem arquitetura/negócio; os `TEST-SPEC.md` no `src/api` descrevem **o que falta testar** e **IDs de cenário** para rastreio em PRs/commits.
