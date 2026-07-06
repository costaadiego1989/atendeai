---
feature: messaging-campaigns-templates
status: specced
created: 2026-05-28
prefix: MCT
---

# Messaging Campaigns & Templates

## Context

Tenants need to send WhatsApp message campaigns to groups of contacts from within the messaging module. Campaigns use pre-registered Meta templates (or free-form text for non-template channels) and optionally delegate variable substitution to the AI. This lives inside the existing `messaging` module — it is NOT the prospecting module.

## Requirements

### Templates

| ID | Requirement |
|----|-------------|
| MCT-01 | Tenant can create a message template with: name, channel (WHATSAPP\|INSTAGRAM), type (TEXT\|META_TEMPLATE), body (with `{{variable}}` placeholders), optional `metaTemplateName` (registered name on Meta), variables list |
| MCT-02 | Templates are scoped to `tenantId` + optional `branchId` |
| MCT-03 | Template CRUD: create, list, get, update, delete (soft-delete) |
| MCT-04 | Template `type=META_TEMPLATE` requires `metaTemplateName` to be set |
| MCT-05 | Templates are reusable across multiple campaigns |

### Campaigns

| ID | Requirement |
|----|-------------|
| MCT-06 | Tenant can create a campaign: name, templateId, audienceType (`ALL_CONTACTS` \| `CONTACT_LIST`), targetContactIds[] (when CONTACT_LIST), optional scheduledAt |
| MCT-07 | Campaign status lifecycle: `DRAFT → SCHEDULED → RUNNING → COMPLETED` (or `FAILED`, `CANCELLED`) |
| MCT-08 | Campaign can be triggered manually ("Enviar agora") or set for future date (`scheduledAt`) |
| MCT-09 | Campaign can have `aiEnabled = true`: AI substitutes `{{variable}}` tokens per contact using contact data |
| MCT-10 | Campaign tracks: totalContacts, sentCount, failedCount, startedAt, completedAt |
| MCT-11 | Sending one message per contact: uses existing messaging send flow (WhatsApp via branch credentials) |
| MCT-12 | Campaign can be cancelled before completion |
| MCT-13 | Tenant can list campaigns with filters (status, channel) |

### Frontend

| ID | Requirement |
|----|-------------|
| MCT-14 | New tab/section "Campanhas" inside the messaging module (`/app/messaging/campaigns`) |
| MCT-15 | Template manager page: create/edit/delete templates, variable preview |
| MCT-16 | Campaign creation wizard: select template → choose audience → set schedule/AI option → confirm |
| MCT-17 | Campaign list with status badges and progress (sentCount / totalContacts) |
| MCT-18 | "Enviar agora" and "Agendar" buttons on campaign |

## Out of Scope

- MCT-X1: Integration with ProspectCampaign — separate feature, no coupling
- MCT-X2: Reply tracking / conversation attribution per campaign send
- MCT-X3: A/B testing templates
- MCT-X4: Campaign analytics dashboard (deferred)

## Acceptance Criteria

1. Create template (META_TEMPLATE, `metaTemplateName=hello_world`, 1 variable `{{name}}`), create campaign targeting 3 contacts → trigger → all 3 receive message with variable filled.
2. Create campaign with `aiEnabled=true` → AI fills `{{name}}` with contact's first name from CRM.
3. Campaign with future `scheduledAt` stays in `SCHEDULED` until BullMQ job fires.
4. Deleting a template used by an in-progress campaign returns 409.
5. All API endpoints return 403 when accessing data from another tenant.

## Module Placement

- API: `src/api/src/modules/messaging/` — new subdomain `campaigns/` and `templates/`
- Prisma schema: `messaging_schema` — new models `MessageTemplate`, `MessageCampaign`
- Queue: `message-campaign-jobs` (BullMQ)
- Frontend: `src/app/src/modules/messaging/` — new views `CampaignsPage`, `TemplatesPage`
- Route: `/app/messaging/campaigns`, `/app/messaging/templates`
