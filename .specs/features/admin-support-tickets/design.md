# Design: Admin Support Tickets

## Architecture

```
[Web /admin/support] → [PlatformAdminApiKeyGuard] → [PlatformSupportController]
                                                          │
                                    ┌─────────────────────┼─────────────────────┐
                                    ▼                     ▼                     ▼
                        ListAllFeedbacksUseCase  ReplyFeedbackUseCase  UpdateFeedbackStatusUseCase
                                    │                     │
                                    ▼                     ▼
                        ISupportFeedbackRepository   IMessagingFacade
                                                    (queueSystemMessage)
```

## API Endpoints (Platform Admin)

| Method | Route | Purpose | Req |
|--------|-------|---------|-----|
| GET | `/platform/support/feedbacks` | List all feedbacks (cross-tenant, paginated, filterable) | REQ-AST-001 |
| GET | `/platform/support/feedbacks/:feedbackId` | Get feedback details + replies | REQ-AST-002 |
| POST | `/platform/support/feedbacks/:feedbackId/reply` | Reply to feedback + send WhatsApp | REQ-AST-003 |
| PATCH | `/platform/support/feedbacks/:feedbackId/status` | Update feedback status | REQ-AST-004 |

All endpoints protected by `PlatformAdminApiKeyGuard`.

## Database Changes

### New table: `feedback_replies` (support_schema)

```prisma
model SupportFeedbackReply {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  feedbackId String   @map("feedback_id") @db.Uuid
  authorName String   @map("author_name") @db.VarChar(100)
  message    String   @db.Text
  sentVia    String?  @map("sent_via") @db.VarChar(30)  // WHATSAPP, EMAIL, null
  messageId  String?  @map("message_id") @db.Uuid       // ref to sent message
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([feedbackId], name: "idx_feedback_replies_feedback")
  @@map("feedback_replies")
  @@schema("support_schema")
}
```

### Changes to existing `SupportFeedback` repository

Add methods:
- `findAll(filters)` — cross-tenant, paginated
- `findById(feedbackId)` — without tenant scope (admin)
- `updateStatus(feedbackId, status)`
- `createReply(input)` — insert into feedback_replies
- `listReplies(feedbackId)` — list replies for a feedback

## Use Cases

### ListAllFeedbacksUseCase
- Input: `{ page, limit, type?, status?, tenantId? }`
- Output: `{ data: FeedbackSummary[], meta: { total, page, limit } }`
- Joins with tenant info to show company name

### GetFeedbackDetailsUseCase
- Input: `{ feedbackId }`
- Output: `{ feedback, replies[], tenant: { name } }`

### ReplyFeedbackUseCase
- Input: `{ feedbackId, message, authorName }`
- Flow:
  1. Find feedback by ID
  2. Save reply to `feedback_replies`
  3. Update status to REVIEWED if OPEN
  4. Find user's phone (via tenant auth user → contact)
  5. Send WhatsApp via `MessagingFacade.queueSystemMessage`
  6. Return reply + delivery status

### UpdateFeedbackStatusUseCase
- Input: `{ feedbackId, status }`
- Validates transition, updates record

## Frontend (src/web)

### New Routes
- `/admin` — login page (API key input)
- `/admin/support` — feedbacks table + filters
- `/admin/support/:id` — detail view (could be modal or page)

### Components
- `AdminLayout` — sidebar with nav, header with logout
- `AdminLoginPage` — simple API key form, stores in localStorage
- `SupportFeedbacksPage` — table with filters, pagination
- `FeedbackDetailDrawer` — slide-over with details + reply form
- `ReplyForm` — textarea + send button
- `StatusBadge` — colored badge per status/type

### API Client
- Custom fetch wrapper that adds `x-platform-admin-key` header from localStorage
- TanStack Query hooks for data fetching

## Message Format

Reply sent via WhatsApp:
```
[Suporte AtendeAi] 

{message}

---
Em resposta ao seu feedback: "{feedback.title}"
```
