---
feature: messaging-campaigns-templates
phase: tasks
---

# Tasks — Messaging Campaigns & Templates

## T1 — Prisma: MessageTemplate + MessageCampaign models
**What:** Add `MessageTemplate` and `MessageCampaign` models to schema (messaging_schema), run migration.
**Where:** `src/api/prisma/schema.prisma`
**Done when:** `npx prisma migrate dev` succeeds, `npx prisma generate` regenerates client.
**Tests:** Migration file valid, no existing model conflicts.
**Gate:** `npx prisma generate`

## T2 — Domain: MessageTemplate entity + value objects
**What:** `MessageTemplate` entity, `TemplateChannel` VO, `TemplateType` VO. Domain rules: META_TEMPLATE requires metaTemplateName.
**Where:** `messaging/campaigns/domain/`
**Depends on:** T1
**Done when:** Unit tests pass for entity construction, validation rules.
**Tests:** `MessageTemplate.spec.ts`
**Gate:** `npm test -- --testPathPattern=MessageTemplate`

## T3 — Domain: MessageCampaign entity + status machine
**What:** `MessageCampaign` entity. Status transitions: DRAFT→SCHEDULED (if scheduledAt), DRAFT→RUNNING (immediate), RUNNING→COMPLETED/FAILED, any→CANCELLED. `activate()`, `cancel()`, `complete()` methods.
**Where:** `messaging/campaigns/domain/`
**Depends on:** T1
**Done when:** Unit tests cover all valid + invalid transitions.
**Tests:** `MessageCampaign.spec.ts`
**Gate:** `npm test -- --testPathPattern=MessageCampaign`

## T4 — Infra: Repositories
**What:** `PrismaMessageTemplateRepository`, `PrismaMessageCampaignRepository`. All queries scoped by tenantId.
**Where:** `messaging/campaigns/infrastructure/repositories/`
**Depends on:** T1, T2, T3
**Done when:** CRUD operations work; tenant isolation enforced (query always includes tenantId).
**Tests:** Repository unit tests with mocked Prisma client.
**Gate:** `npm test -- --testPathPattern=PrismaMessageTemplate|PrismaMessageCampaign`

## T5 — Application: Template use cases
**What:** `CreateMessageTemplateUseCase`, `UpdateMessageTemplateUseCase`, `DeleteMessageTemplateUseCase` (soft-delete, blocks if active campaign uses template), `ListMessageTemplatesUseCase`.
**Where:** `messaging/campaigns/application/use-cases/`
**Depends on:** T2, T4
**Done when:** Unit tests for each use case including guard: delete fails with 409 if campaign in-progress uses template.
**Tests:** `*.use-case.spec.ts`
**Gate:** `npm test -- --testPathPattern=MessageTemplate.*UseCase`

## T6 — Application: Campaign use cases
**What:** `CreateMessageCampaignUseCase`, `TriggerMessageCampaignUseCase` (immediate: set RUNNING + enqueue; scheduled: set SCHEDULED), `CancelMessageCampaignUseCase`, `ListMessageCampaignsUseCase`.
**Where:** `messaging/campaigns/application/use-cases/`
**Depends on:** T3, T4
**Done when:** Unit tests cover trigger flow, cancel guard (only DRAFT/SCHEDULED cancellable), schedule future.
**Tests:** `*.use-case.spec.ts`
**Gate:** `npm test -- --testPathPattern=MessageCampaign.*UseCase`

## T7 — Infra: BullMQ Campaign Worker
**What:** `MessageCampaignQueue` (producer) + `MessageCampaignWorker` (consumer). Worker: loads campaign, resolves contacts, calls messaging send port per contact, updates sentCount/failedCount, sets COMPLETED/FAILED. If `aiEnabled`, calls AI variable resolver.
**Where:** `messaging/campaigns/infrastructure/queues/`
**Depends on:** T6
**Done when:** Unit tests for worker logic (mocked messaging port, mocked AI port). Integration: enqueue 3 contacts → 3 sends called.
**Tests:** `MessageCampaignWorker.spec.ts`
**Gate:** `npm test -- --testPathPattern=MessageCampaignWorker`

## T8 — Presentation: REST controllers
**What:** `MessageTemplateController` (CRUD at `/tenants/:tenantId/messaging/templates`), `MessageCampaignController` (CRUD + trigger + cancel). JWT guard + tenant scope middleware.
**Where:** `messaging/campaigns/presentation/controllers/`
**Depends on:** T5, T6
**Done when:** E2E: create template → create campaign → trigger → 200 responses.
**Tests:** `*.controller.e2e-spec.ts` (HTTP layer)
**Gate:** `npm run test:e2e -- --testPathPattern=MessageTemplate|MessageCampaign`

## T9 — Frontend: Templates page + service
**What:** `TemplatesPage.tsx`, `TemplateForm.tsx`, `templates-service.ts`, `useTemplatesViewModel.ts`. CRUD UI for templates, variable preview renderer.
**Where:** `src/app/src/modules/messaging/`
**Depends on:** T8
**Done when:** Can create/edit/delete template. Variable `{{name}}` shows preview substitution.
**Tests:** Manual + smoke test.
**Gate:** Dev server starts, page renders.

## T10 — Frontend: Campaigns page + wizard
**What:** `CampaignsPage.tsx`, `CampaignWizard.tsx`, `CampaignCard.tsx`, `campaigns-service.ts`, `useCampaignsViewModel.ts`. Wizard: step1=template, step2=audience, step3=schedule+AI toggle.
**Where:** `src/app/src/modules/messaging/`
**Depends on:** T9
**Done when:** Full wizard flow works, campaign list shows status + progress bar.
**Tests:** Manual.
**Gate:** Dev server starts, wizard completes.

## T11 — Frontend: Sidebar routes + AppLayout wiring
**What:** Add "Campanhas" and "Templates" nav items to messaging section in `AppLayout.tsx`. Add routes in router config.
**Where:** `src/app/src/app/layouts/AppLayout.tsx`, router config
**Depends on:** T9, T10
**Done when:** Routes `/app/messaging/campaigns` and `/app/messaging/templates` accessible from sidebar.
**Tests:** Manual navigation.
**Gate:** Dev server starts, links work.

## Execution Order

```
T1 → T2, T3 (parallel)
     T2, T3 → T4
               T4 → T5, T6 (parallel)
                    T5, T6 → T7, T8 (parallel)
                              T8 → T9 → T10 → T11
```

## Traceability

| Task | Requirements |
|------|-------------|
| T1   | MCT-01, MCT-02 |
| T2   | MCT-01, MCT-03, MCT-04 |
| T3   | MCT-06, MCT-07, MCT-12 |
| T4   | MCT-02, MCT-05 |
| T5   | MCT-03, MCT-04, MCT-05 |
| T6   | MCT-06, MCT-07, MCT-08, MCT-12 |
| T7   | MCT-09, MCT-10, MCT-11 |
| T8   | MCT-10, MCT-13 |
| T9   | MCT-15 |
| T10  | MCT-14, MCT-16, MCT-17, MCT-18 |
| T11  | MCT-14 |
