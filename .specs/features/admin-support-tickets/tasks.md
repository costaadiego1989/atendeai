# Tasks: Admin Support Tickets

## T1: Prisma schema — feedback_replies table
- **What:** Add `SupportFeedbackReply` model to Prisma schema + run migration
- **Where:** `src/api/prisma/schema.prisma`
- **Depends on:** nothing
- **Done when:** `npx prisma generate` succeeds, migration created
- **Gate:** `npx prisma generate` + `npm run build`

## T2: Repository — extend ISupportFeedbackRepository
- **What:** Add admin methods: `findAll`, `findById`, `updateStatus`, `createReply`, `listReplies`
- **Where:** `src/api/modules/support/domain/repositories/ISupportFeedbackRepository.ts`, `src/api/modules/support/infrastructure/persistence/repositories/PrismaSupportFeedbackRepository.ts`
- **Depends on:** T1
- **Done when:** Methods implemented with proper SQL
- **Gate:** `npm run build`

## T3: Use cases — ListAllFeedbacks, GetFeedbackDetails, UpdateFeedbackStatus
- **What:** Create 3 use cases for admin operations (read + status update)
- **Where:** `src/api/modules/support/application/use-cases/`
- **Depends on:** T2
- **Done when:** Use cases instantiable and tested
- **Gate:** `npm test -- --testPathPatterns="support"`

## T4: Use case — ReplyFeedbackUseCase
- **What:** Create reply use case that saves reply + sends WhatsApp via MessagingFacade
- **Where:** `src/api/modules/support/application/use-cases/ReplyFeedbackUseCase.ts`
- **Depends on:** T2, T3
- **Done when:** Reply saved, message queued, status updated
- **Gate:** `npm test -- --testPathPatterns="support"`

## T5: Controller — PlatformSupportController
- **What:** Create admin controller with 4 endpoints, protected by PlatformAdminApiKeyGuard
- **Where:** `src/api/modules/platform-admin/presentation/controllers/PlatformSupportController.ts`
- **Depends on:** T3, T4
- **Done when:** Endpoints respond correctly
- **Gate:** `npm run build`

## T6: Module wiring — register use cases and controller
- **What:** Wire new use cases in support.module.ts, register controller in platform-admin.module.ts
- **Where:** `src/api/modules/support/support.module.ts`, `src/api/modules/platform-admin/platform-admin.module.ts`
- **Depends on:** T5
- **Gate:** `npm run build` + API starts without errors

## T7: Frontend — Admin layout, login, API client
- **What:** Create admin section with API key login, layout, and fetch wrapper
- **Where:** `src/web/src/pages/admin/`
- **Depends on:** nothing (parallel with backend)
- **Done when:** Login stores key, layout renders, API client sends header
- **Gate:** `npm run build` (web)

## T8: Frontend — Support feedbacks page
- **What:** Table with feedbacks, filters (type, status), pagination
- **Where:** `src/web/src/pages/admin/support/`
- **Depends on:** T7
- **Done when:** Page renders with mock data, filters work
- **Gate:** `npm run build` (web)

## T9: Frontend — Feedback detail + reply
- **What:** Detail drawer/modal with reply form, status change buttons
- **Where:** `src/web/src/pages/admin/support/`
- **Depends on:** T8
- **Done when:** Detail shows, reply submits, status updates
- **Gate:** `npm run build` (web)

## T10: Integration tests
- **What:** Unit tests for use cases + E2E test for admin endpoints
- **Where:** `src/api/modules/support/__tests__/`
- **Depends on:** T6
- **Gate:** `npm test -- --testPathPatterns="support"`

## Execution Order

```
T1 → T2 → T3 → T4 → T5 → T6 → T10
                                    
T7 → T8 → T9  (parallel with backend)
```
