# Módulo: `support`

**Caminho:** `src/api/modules/support`  
**Última análise:** 2026-05-03  
**Papel:** feedback/support tickets leves CRUD sobre `SupportFeedback`/repositório Prisma (`support_schema.feedbacks`).

## Valor ao utilizador / oportunidades

- Fecho do loop UX — capturar dor do tenant para roadmap.
- **Contexto espacial:** campo `appModule` (slug estável snake_case por área funcional da app — ex.: `catalog`, `messaging`) além de `pagePath`; alimenta filtros/analytics produto sem depender apenas da URL.
- **Frontend:** botão flutuante + modal contextual (`ModuleFeedbackFab` no `AppLayout`) em todas as páginas autenticadas, com lista detalhes em `/app/settings/support`.
- **Melhorias futuras:** anexos, SLA resposta produto interno.

## Implementação recente

- **`POST /support/feedbacks`:** body opcional `appModule`; persistência em `app_module` (+ índice parcial onde não nulo).
- **`CreateSupportFeedbackUseCase`:** `StructuredLogEmitter` `support.feedback.created` com `tenantId`, `feedback_id`, `type`, `app_module`.

## Acoplamento / manutenção

- Fraco por desenho (Database + Auth) — ótimo para manutenção; evitar crescimento orgânico com dependências até ao messaging sem porta.
- Resolver de rotas ↔ módulo mora na UI em `shared/constants/feedback-app-module.ts`; manter lista alinhada com rotas `/app/**` quando surgirem páginas novas.

## Logs e traces distribuídos

- Criação: log estruturado com `feedbackId` e correlacionável ao tenant (`StructuredLogEmitter`); volume baixo; tracing profundo difereível.

## KISS / DRY

- Manter use case fino um-per-endpoint até necessidade real de CQRS/read side.
