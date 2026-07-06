# Tasks — Execução (dependências explícitas)

Legenda: `[P]` pode correr em paralelo com outras `[P]` depois das dependências satisfeitas.

## Fase 0 — Decisões (bloqueante)

| ID | Tarefa | Done when |
|----|--------|-----------|
| T0.1 | ~~Fechar decisões em `context.md`~~ | **Feito** (2026-05-04). Opcional: confirmar código exacto `module_code` COMMERCE nos seeds. |

## Fase 1 — Dados e migração

| ID | Depende de | Tarefa | Done when |
|----|------------|--------|-----------|
| T1.1 | T0.1 | Adicionar modelos Prisma + migration SQL (`conversation_sale_events`, tabelas commission/user profile). | `prisma migrate` aplica limpo em dev. |
| T1.2 | T1.1 | `prisma generate` + índices UNIQUE/void conforme design. | Build API types ok. |

## Fase 2 — API core (venda)

| ID | Depende de | Tarefa | Done when |
|----|------------|--------|-----------|
| T2.1 | T1.2 | Implementar `tenantSupportsManualSaleAttribution` + teste unitário mínimo. | Cobertura do helper. |
| T2.2 | T2.1, **serviço IA** | Use case pedido de marcação → **ATT-SALES-007** validação IA → persistência APPROVED/REJECTED. | Testes com IA mockada. |
| T2.3 | T2.2 | Endpoints REST + DTOs + guards (**AGENT** pode POST pendente; resposta reflecte estado IA). | |
| T2.4 | T2.2 | Void/correcção conforme ATT-SALES-005. | Mesmos testes mínimos. |
| T2.5 | T2.3 `[P]` | Endpoint resumo vendas por usuário (**só eventos APPROVED** / métricas válidas). | |

## Fase 3 — API comissão / perfis

| ID | Depende de | Tarefa | Done when |
|----|------------|--------|-----------|
| T3.1 | T1.2 | CRUD defaults tenant comissão. | OWNER/ADMIN only. |
| T3.2 | T3.1 | CRUD perfil por `userId` (override + metas). | |
| T3.3 | T2.5, T3.2 `[P]` | (Opcional P2) Endpoint comissão estimada período. | Documentar fórmula no código. |

## Fase 4 — Frontend

| ID | Depende de | Tarefa | Done when |
|----|------------|--------|-----------|
| T4.1 | T2.3 | Serviço API + tipos no app; acção inbox + modal marcar venda. | Fluxo manual testado. |
| T4.2 | T3.2 | Modal equipa: política base + override + metas por utilizador. | Só papel gestor. |
| T4.3 | T4.1 `[P]` | Badge lista conversas quando venda activa (UI-003). | |

## Fase 5 — Verificação e docs

| ID | Depende de | Tarefa | Done when |
|----|------------|--------|-----------|
| T5.1 | T2–T4 | `nest build` + smoke e2e crítico se existir harness. | Verde. |
| T5.2 | T5.1 | Atualizar `IMPLEMENTATION-GAP` messaging/sales/users no app conforme política do repo. | Links e IDs ATT-SALES/COMM. |

---

**Commits:** preferir atomic por tarefa (migração isolada; API; UI).
