---
feature: scheduled-messages
status: specced
created: 2026-05-28
prefix: SCH
---

# Scheduled Messages

## Context

Users need to schedule messages for future delivery in two modes:
1. **Individual**: Schedule a single message to a specific conversation (contact) for a future date/time.
2. **Bulk**: Schedule a broadcast message to multiple contacts at a future date/time (overlaps with Campaign Templates feature — bulk scheduled = campaign with `scheduledAt`).

The bulk mode is handled by the messaging-campaigns-templates feature (`scheduledAt` on `MessageCampaign`). This spec focuses on the **individual** mode plus the shared infrastructure (Prisma model, BullMQ worker) that campaigns also use.

## Requirements

### Shared Infrastructure

| ID | Requirement |
|----|-------------|
| SCH-01 | New `ScheduledMessage` Prisma model: tenantId, branchId, conversationId, content (text or templateId + variables), channel, scheduledAt, status (PENDING\|SENT\|CANCELLED\|FAILED), createdBy, sentAt, failReason |
| SCH-02 | BullMQ delayed job: job fires at `scheduledAt`, sends message via existing messaging port, updates status |
| SCH-03 | If message fails to send: status = FAILED, failReason stored, no retry by default |
| SCH-04 | Cancelled message: job removed from queue if still pending, status = CANCELLED |

### Individual Scheduled Message

| ID | Requirement |
|----|-------------|
| SCH-05 | `POST /tenants/:id/conversations/:convId/messages/schedule` — schedule a message in a specific conversation |
| SCH-06 | Payload: `content` (text), `scheduledAt` (ISO datetime, must be future) |
| SCH-07 | Scheduled message appears in conversation message list with "Agendada para HH:mm DD/MM" indicator |
| SCH-08 | User can cancel a pending scheduled message from the conversation view |
| SCH-09 | `GET /tenants/:id/conversations/:convId/messages/scheduled` — list pending scheduled messages for a conversation |

### Bulk Scheduled (via Campaigns)

| ID | Requirement |
|----|-------------|
| SCH-10 | `MessageCampaign` with `scheduledAt` set → campaign stays SCHEDULED until BullMQ fires |
| SCH-11 | When campaign job fires: set campaign status RUNNING, process contacts same as immediate trigger |
| SCH-12 | Note: this is implemented in messaging-campaigns-templates T6/T7, not here |

### Frontend — Individual

| ID | Requirement |
|----|-------------|
| SCH-13 | "Agendar" button/icon in conversation message input area |
| SCH-14 | Date+time picker dialog to select future date/time |
| SCH-15 | Pending scheduled messages shown in conversation as a distinct chip above the message input: "Mensagem agendada para [date/time]" with cancel button |
| SCH-16 | After scheduled time passes and message is sent, it appears in the normal message thread |

## Out of Scope

- SCH-X1: Recurring scheduled messages (e.g., "every Monday")
- SCH-X2: Scheduled message retry policy (deferred)
- SCH-X3: Bulk individual scheduling (schedule different messages for different contacts at different times)

## Acceptance Criteria

1. Schedule message to conversation for T+5min → message auto-appears in conversation at T+5min.
2. Schedule message → cancel before scheduled time → message NOT sent, status=CANCELLED.
3. Schedule message in past → API returns 422 with "scheduledAt must be in the future".
4. Conversation shows pending scheduled message chip with time.
5. After sending, scheduled message appears in thread with normal message styling.
6. Another tenant's user cannot schedule to or list scheduled messages for a conversation they don't own.

## Module Placement

- API: `messaging` module — new `scheduled-messages` subdomain
- Prisma: `messaging_schema` — new model `ScheduledMessage`
- Queue: `scheduled-messages-queue` (BullMQ delayed jobs)
- Frontend: `src/app/src/modules/messaging/` — changes to conversation message input + message list
