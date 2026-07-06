---
feature: messaging-campaigns-templates
phase: design
---

# Design — Messaging Campaigns & Templates

## Prisma Models (messaging_schema)

```prisma
model MessageTemplate {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId         String    @map("tenant_id") @db.Uuid
  branchId         String?   @map("branch_id") @db.Uuid
  name             String    @db.VarChar(255)
  channel          String    @db.VarChar(20)       // WHATSAPP | INSTAGRAM
  type             String    @default("TEXT") @db.VarChar(30)  // TEXT | META_TEMPLATE
  body             String    @db.Text
  metaTemplateName String?   @map("meta_template_name") @db.VarChar(255)
  variables        Json      @default("[]")         // string[] of variable names
  deletedAt        DateTime? @map("deleted_at") @db.Timestamptz
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  campaigns MessageCampaign[]

  @@index([tenantId, branchId, deletedAt], name: "idx_message_templates_tenant")
  @@map("message_templates")
  @@schema("messaging_schema")
}

model MessageCampaign {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId         String    @map("tenant_id") @db.Uuid
  branchId         String?   @map("branch_id") @db.Uuid
  templateId       String    @map("template_id") @db.Uuid
  name             String    @db.VarChar(255)
  audienceType     String    @map("audience_type") @db.VarChar(30) // ALL_CONTACTS | CONTACT_LIST
  targetContactIds Json      @default("[]") @map("target_contact_ids") // string[]
  status           String    @default("DRAFT") @db.VarChar(20)
  aiEnabled        Boolean   @default(false) @map("ai_enabled")
  scheduledAt      DateTime? @map("scheduled_at") @db.Timestamptz
  startedAt        DateTime? @map("started_at") @db.Timestamptz
  completedAt      DateTime? @map("completed_at") @db.Timestamptz
  totalContacts    Int       @default(0) @map("total_contacts")
  sentCount        Int       @default(0) @map("sent_count")
  failedCount      Int       @default(0) @map("failed_count")
  createdBy        String    @map("created_by") @db.Uuid
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  template MessageTemplate @relation(fields: [templateId], references: [id])

  @@index([tenantId, status], name: "idx_message_campaigns_tenant_status")
  @@index([scheduledAt, status], name: "idx_message_campaigns_scheduled")
  @@map("message_campaigns")
  @@schema("messaging_schema")
}
```

## Domain Layer

```
messaging/campaigns/
  domain/
    entities/
      MessageTemplate.ts          # value objects: channel, type, variables
      MessageCampaign.ts          # status machine: DRAFT→SCHEDULED→RUNNING→COMPLETED
    value-objects/
      CampaignStatus.ts
      TemplateChannel.ts
    events/
      CampaignTriggeredEvent.ts
      CampaignCompletedEvent.ts
  application/
    use-cases/
      CreateMessageTemplateUseCase.ts
      UpdateMessageTemplateUseCase.ts
      DeleteMessageTemplateUseCase.ts
      ListMessageTemplatesUseCase.ts
      CreateMessageCampaignUseCase.ts
      TriggerMessageCampaignUseCase.ts     # sets status RUNNING, enqueues job
      CancelMessageCampaignUseCase.ts
      ListMessageCampaignsUseCase.ts
    ports/
      IMessageTemplateRepository.ts
      IMessageCampaignRepository.ts
      IMessageCampaignQueuePort.ts         # enqueue(campaignId)
  infrastructure/
    repositories/
      PrismaMessageTemplateRepository.ts
      PrismaMessageCampaignRepository.ts
    queues/
      MessageCampaignQueue.ts              # BullMQ producer
      MessageCampaignWorker.ts             # BullMQ consumer: loads campaign, sends per contact
  presentation/
    controllers/
      MessageTemplateController.ts         # /tenants/:id/messaging/templates
      MessageCampaignController.ts         # /tenants/:id/messaging/campaigns
```

## API Endpoints

```
GET    /tenants/:tenantId/messaging/templates
POST   /tenants/:tenantId/messaging/templates
GET    /tenants/:tenantId/messaging/templates/:id
PUT    /tenants/:tenantId/messaging/templates/:id
DELETE /tenants/:tenantId/messaging/templates/:id

GET    /tenants/:tenantId/messaging/campaigns
POST   /tenants/:tenantId/messaging/campaigns
GET    /tenants/:tenantId/messaging/campaigns/:id
POST   /tenants/:tenantId/messaging/campaigns/:id/trigger
POST   /tenants/:tenantId/messaging/campaigns/:id/cancel
```

## Campaign Worker Flow

1. Receive `campaignId` from queue
2. Load campaign + template; validate status = RUNNING
3. Resolve contacts: if ALL_CONTACTS → query all tenant contacts; else use targetContactIds
4. For each contact:
   a. Resolve variables: if `aiEnabled` → call AI port with contact data; else use contact.name etc.
   b. Build message payload (META_TEMPLATE → WhatsApp template message; TEXT → free text)
   c. Call existing messaging send port (reuse ProspectCampaign send path)
   d. Increment sentCount or failedCount
5. Update campaign status to COMPLETED (or FAILED if 0 sent)

## AI Variable Resolution

- Use existing `AI` module port (already used in prospecting for variable generation)
- Port: `ITemplateVariableResolverPort.resolve(template, contact): Record<string,string>`
- If AI fails per contact: fallback to contact.name / empty string (do NOT fail entire campaign)

## Frontend Structure

```
src/app/src/modules/messaging/
  views/
    CampaignsPage.tsx        # /app/messaging/campaigns
    TemplatesPage.tsx        # /app/messaging/templates  
  components/
    CampaignWizard.tsx       # multi-step: template → audience → schedule
    CampaignCard.tsx         # status + progress bar
    TemplateForm.tsx         # create/edit template with variable preview
  services/
    campaigns-service.ts
    templates-service.ts
  view-models/
    useCampaignsViewModel.ts
    useTemplatesViewModel.ts
```

## Tenant Isolation Checklist

- Every query: `WHERE tenant_id = :tenantId`
- templateId FK verified against same tenantId before campaign creation
- Worker loads campaign with tenantId check
- No cross-tenant contact leak in ALL_CONTACTS audience
