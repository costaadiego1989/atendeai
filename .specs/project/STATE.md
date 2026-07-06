# Project state

## Decisions

### PROSPECTING-001 — Scope freeze on MODULE-prospecting.md (2026-05-04)

- **Source:** `docs/api-modules-review/MODULE-prospecting.md`
- **Decision:** Do not implement in code the items explicitly labeled **Melhorias** or **Features** in that document (compliance/metrics; pacing comercial; segmentação por tags). Refactors (facades-only), distributed tracing notes, and KISS contact-write centralization remain **deferred** until reprioritized—not in this execution cycle.
- **Rationale:** Product/engineering asked to exclude those tracks from automated implementation while keeping the review doc as the single reference.

## Feature specs (active)

### PROSP-ENT — Prospecting Enterprise Campaign Engine (2026-05-17)

- **Folder:** `.specs/features/prospecting-enterprise-campaign/`
- **Scope:** Template WhatsApp API, anti-abuso (cooldown/delay/block-rate), badge UI, webhook Meta qualidade
- **Decisões-chave:**
  - Envio via `queueTemplateMessage` (não texto livre); fallback texto livre mantido para backwards compat
  - Cooldown cross-campaign (por contactId, não por campaignId)
  - Webhook Meta valida HMAC-SHA256; endpoint público sem JWT
  - PROSP-06 (IA variáveis P3) deferido para próxima fase
- **Next:** Executar T1 (Prisma schema) → T2 → T3 → paralelo T4/T6/T7 → T5 → T8 → T9 → T10
- **Nota:** Este spec é **novo** e não conflita com PROSPECTING-001 (aquele freeze era sobre melhorias do MODULE-prospecting.md; este é requisito novo de produto)



### ATT-SALES / COMM — Conversão manual por conversa + comissões (2026-05-04)

- **Folder:** `.specs/features/conversation-sales-attribution/`
- **Decisões:** Ver `context.md` (OWNER/ADMIN config; AGENT + IA confirma; comissão % + fixo; ATT-SALES-010 via nichos/`subscription_modules`).
- **Next:** Execução `tasks.md` a partir de **T1** (após confirmar `module_code` COMMERCE nos seeds, se necessário).

### MCT — Messaging Campaigns & Templates (2026-05-28)

- **Folder:** `.specs/features/messaging-campaigns-templates/`
- **Scope:** `MessageTemplate` + `MessageCampaign` Prisma models (messaging_schema), CRUD use cases, BullMQ worker (per-contact send), AI variable substitution, frontend: `/app/messaging/campaigns` + `/app/messaging/templates`
- **Decisões-chave:**
  - Lives inside `messaging` module — NOT prospecting
  - `audienceType`: ALL_CONTACTS ou CONTACT_LIST
  - `aiEnabled`: AI substitui variáveis `{{var}}` por contact data
  - Bulk scheduled = campaign com `scheduledAt` (handled here, not in scheduled-messages spec)
- **Next:** T1 (Prisma) → T2, T3 (parallel) → T4 → T5, T6 → T7, T8 → T9 → T10 → T11

### AGC — Alerts Google Calendar Integration (2026-05-28)

- **Folder:** `.specs/features/alerts-google-calendar/`
- **Scope:** Vincular criação/atualização/exclusão de alertas ao Google Calendar do usuário. `AlertCalendarEventLink` model (scheduling_schema). Port `IGoogleCalendarAlertPort`. Graceful degradation.
- **Decisões-chave:**
  - OAuth Google Calendar já existe (`GoogleCalendarConnectionScope` com userId)
  - Isolamento por usuário: cada user tem seu próprio Google Calendar
  - Alerta criado mesmo se Google Calendar falhar (try/catch, log error)
  - Sem backfill de alertas antigos
- **Next:** T1 (Prisma) → T2, T3 (parallel) → T4 → T5 → T6 → T7

### CAL — Calendar Page Frontend (2026-05-28)

- **Folder:** `.specs/features/calendar-page/`
- **Scope:** Novo item "Calendário" no sidebar principal. Route `/app/calendar`. Endpoint aggregador `GET /tenants/:id/calendar/events`. Mostra: agendamentos, alertas, mensagens agendadas, Google Calendar events.
- **Decisões-chave:**
  - Novo módulo `calendar` na API (não dentro de scheduling)
  - Google Calendar buscado server-side (tokens não expostos ao frontend)
  - 4 tipos de evento com cores distintas
  - Views: Month/Week/Day
- **Next:** T1 (API) → T2 → T3 → T4, T5 (parallel) → T6
- **Depende de:** SCH T1 (ScheduledMessage model) + AGC T4 (Google Calendar adapter)

### SCH — Scheduled Messages (2026-05-28)

- **Folder:** `.specs/features/scheduled-messages/`
- **Scope:** `ScheduledMessage` model (messaging_schema), BullMQ delayed jobs, individual scheduling por conversa. Bulk scheduling via campaigns (spec MCT).
- **Decisões-chave:**
  - BullMQ delayed jobs (não cron): `queue.add(..., { delay: ms })`
  - `bullmqJobId` stored para permitir cancelamento
  - Worker idempotente: skip se status != PENDING
  - Frontend: botão "Agendar" no input da conversa + banner de mensagem pendente
- **Next:** T1 (Prisma) → T2, T3 (parallel) → T4 → T5 → T6 → T7 → T8
- **Status:** T1✅ T2✅ T3✅ T4✅ T5✅ T6✅ — **Next: T7 (frontend schedule button)**

### AI-LANG — AI LangChain Refactor (2026-07-06)

- **Folder:** `.specs/features/ai-langchain-refactor/`
- **Scope:** Refatoração completa do sistema de IA — substituir chamadas HTTP diretas (axios→DeepSeek/Anthropic) por LangChain.js com JSON Structured Outputs (Zod validation), retry automático, fallback multi-provider, observabilidade por chain.
- **Decisões-chave:**
  - LangChain.js como orchestration layer (não substituir providers)
  - DeepSeek continua primário; Anthropic = fallback
  - Zod schemas por caso de uso (domain layer)
  - PromptTemplates versionados por módulo (infrastructure)
  - Feature flag `AI_USE_LANGCHAIN` para rollout gradual
  - 4 fases: Foundation → Core Migration → Consumer Migration → Cleanup
  - TDD obrigatório: FakeChatModel para unit tests
- **Módulos impactados:** ai, recovery, prospecting, social, messaging, sales, platform-admin, voice
- **Risk:** HIGH (toca todo sistema de conversa/IA)
- **Next:** Phase 1 — install deps, shared infra, FakeChatModel, parsers, factories

## Quick tasks log

| Date       | Slug                         | Summary                                      |
| ---------- | ---------------------------- | -------------------------------------------- |
| 2026-05-04 | `001-prospecting-review-scope` | Scope freeze documented; no prospecting code |
