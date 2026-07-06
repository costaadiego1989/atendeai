---
feature: scheduled-messages
phase: design
---

# Design — Scheduled Messages

## Prisma Model (messaging_schema)

```prisma
model ScheduledMessage {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId       String    @map("tenant_id") @db.Uuid
  branchId       String?   @map("branch_id") @db.Uuid
  conversationId String    @map("conversation_id") @db.Uuid
  content        String    @db.Text
  contentType    String    @default("TEXT") @map("content_type") @db.VarChar(20)
  channel        String    @db.VarChar(20)
  scheduledAt    DateTime  @map("scheduled_at") @db.Timestamptz
  status         String    @default("PENDING") @db.VarChar(20) // PENDING | SENT | CANCELLED | FAILED
  createdBy      String    @map("created_by") @db.Uuid
  sentAt         DateTime? @map("sent_at") @db.Timestamptz
  failReason     String?   @map("fail_reason") @db.VarChar(500)
  bullmqJobId    String?   @map("bullmq_job_id") @db.VarChar(255)
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@index([tenantId, conversationId, status], name: "idx_scheduled_messages_tenant_conv")
  @@index([scheduledAt, status], name: "idx_scheduled_messages_due")
  @@map("scheduled_messages")
  @@schema("messaging_schema")
}
```

## Domain Layer

```
messaging/scheduled-messages/
  domain/
    entities/
      ScheduledMessage.ts       # status: PENDING→SENT|CANCELLED|FAILED
    events/
      ScheduledMessageFiredEvent.ts
  application/
    use-cases/
      CreateScheduledMessageUseCase.ts    # validates scheduledAt > now, enqueues delayed job
      CancelScheduledMessageUseCase.ts    # removes BullMQ job, sets CANCELLED
      ListScheduledMessagesUseCase.ts     # by conversationId + tenantId, status=PENDING
    ports/
      IScheduledMessageRepository.ts
      IScheduledMessageQueuePort.ts       # add(scheduledMessageId, delay): jobId; remove(jobId)
  infrastructure/
    repositories/
      PrismaScheduledMessageRepository.ts
    queues/
      ScheduledMessageQueue.ts            # BullMQ delayed job producer
      ScheduledMessageWorker.ts           # consumer: send message, update status
  presentation/
    controllers/
      ScheduledMessageController.ts       # nested under conversations
```

## BullMQ Job Strategy

- Use BullMQ **delayed jobs**: `queue.add('send', { scheduledMessageId }, { delay: ms })`
- Store `jobId` in `ScheduledMessage.bullmqJobId` for cancellation
- Cancel: `queue.remove(jobId)` then update status CANCELLED
- Worker: load ScheduledMessage by id → if PENDING: call messaging send port → update SENT/FAILED

## Worker Flow

```
1. Load ScheduledMessage (tenantId scoped)
2. Verify status = PENDING (idempotency: skip if already SENT/CANCELLED)
3. Load conversation to get channel + recipient info
4. Call existing messaging send port (same as normal message send)
5. On success: status = SENT, sentAt = now()
6. On failure: status = FAILED, failReason = error.message
```

## API Endpoints

```
POST /tenants/:tenantId/conversations/:conversationId/messages/schedule
  Body: { content: string, scheduledAt: ISO8601 }
  Validates: scheduledAt > now(), conversationId belongs to tenantId

GET  /tenants/:tenantId/conversations/:conversationId/messages/scheduled
  Returns: ScheduledMessage[] where status=PENDING

DELETE /tenants/:tenantId/conversations/:conversationId/messages/scheduled/:id
  Cancels pending scheduled message
```

## Frontend Changes

### Conversation message input area
- Add clock/schedule icon button next to send button
- Click → `ScheduleMessageDialog.tsx`: datetime picker (future only), confirm button
- On confirm: POST `.../messages/schedule`

### Pending message chip (above input)
- `ScheduledMessageBanner.tsx`: fetches GET `.../messages/scheduled` on mount
- Shows: "📅 Mensagem agendada para [date/time]" with X (cancel) button
- On cancel: DELETE request, removes chip

### Message thread
- Sent scheduled messages appear as normal messages in thread
- No special styling needed (server sends as regular message)

## Tenant Isolation

- All queries: `WHERE tenant_id = :tenantId`
- Conversation ownership verified before creating scheduled message
- Worker loads with tenantId check (job payload only has scheduledMessageId, worker verifies)
