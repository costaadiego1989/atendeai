# API E2E guarantee plan

Last review: 2026-05-08

Scope: `src/api/modules`

This document turns the current API test inventory into a practical plan for adding high-value tests. The goal is not "more tests by volume"; the goal is confidence that each module preserves its business invariants, tenant boundaries, async flows, and externally visible contracts.

## How to use this plan

- Start every new test from an invariant: money cannot be counted twice, a tenant cannot read another tenant, a webhook cannot process twice, a status transition cannot skip required states.
- Prefer one end-to-end flow that proves a user-visible outcome over many controller tests that only check status codes.
- When a module touches another module, test the event/adapter boundary with a fake or outbox assertion, then keep one e2e smoke for the full user journey.
- Every P0 test added should be referenced in the module `TEST-SPEC.md` using a stable ID.
- If a live third-party test is flaky or expensive, keep it outside the normal CI gate and add a deterministic fake-provider test to the normal CI gate.

## Guarantee layers

| Layer | What it proves | Preferred test shape |
|------|----------------|----------------------|
| Domain invariant | Entity/value object refuses invalid state | Unit spec with edge values |
| Use case orchestration | Repositories, policies, events, and services are called in the right order | Unit spec with fakes |
| API contract | DTO validation, error shape, auth, response body | Controller or e2e spec |
| Persistence | Prisma mapper/query behavior matches schema and tenant filters | Integration spec |
| Async/event | Queue, outbox, webhook, and worker are idempotent | Processor spec plus fake event bus |
| Full flow | User-visible journey works across modules | E2E spec with AppModule |
| Time/concurrency | Race, retry, timezone, scheduling boundaries | Fake timers, parallel promises, transaction assertions |

## Current inventory snapshot

Generated from local files under `src/api/modules` on 2026-05-08.

| Module | Use cases | Controllers | Test files | E2E files | Coverage reading |
|--------|-----------|-------------|------------|-----------|------------------|
| agent-rules | 5 | 1 | 3 | 2 | Good smoke, needs stronger authz/version guarantees |
| ai | 2 | 0 | 19 | 3 | Strong service coverage, needs adapter failure contracts |
| alerts | 5 | 1 | 4 | 0 | Missing e2e/worker confidence |
| auth | 14 | 1 | 12 | 3 | Good core coverage, security matrix can be richer |
| billing | 16 | 3 | 17 | 2 | Good domain coverage, quota race risk remains |
| catalog | 10 | 1 | 2 | 1 | Under-tested for many use cases |
| commerce | 19 | 1 | 10 | 1 | Good focused specs, needs concurrent session tests |
| contact | 20 | 1 | 14 | 3 | Solid CRUD/timeline coverage |
| dashboard | 0 | 0 | 1 | 1 | Cross-module slice, missing dedicated spec doc until now |
| inventory | 6 | 1 | 7 | 1 | Improved unit coverage, provider edge cases remain |
| messaging | 27 | 2 | 38 | 19 | Highest coverage and highest integration risk |
| payment | 4 | 3 | 11 | 3 | Good PSP/webhook start, idempotency must stay central |
| platform-admin | 4 | 1 | 4 | 0 | High-risk admin surface without e2e matrix |
| proposal | 8 | 2 | 12 | 1 | Good lifecycle smoke, needs auth/public-link hardening |
| prospecting | 54 | 5 | 35 | 3 | Broad coverage, async worker smoke should be enforced |
| recovery | 18 | 1 | 12 | 1 | Good core recovery coverage, payment/messaging races remain |
| sales | 20 | 1 | 14 | 2 | Good financial basics, decimal/reporting edges remain |
| scheduling | 26 | 2 | 8 | 2 | Critical flows covered, many use cases still unit-light |
| social | 4 | 2 | 3 | 0 | Needs real webhook contract and auth/signature tests |
| support | 2 | 1 | 2 | 0 | Small module but missing API/tenant isolation e2e |
| tenant | 39 | 4 | 57 | 9 | Strongest coverage, keep reducing e2e runtime risk |

## Cross-module e2e flows to close the application

These are the highest-value end-to-end guarantees because they traverse the business graph.

| ID | Flow | Modules | States to prove |
|----|------|---------|-----------------|
| FLOW-001 | Trial signup to active tenant | payment, tenant, billing, auth, messaging | signup requested -> PSP customer/payment created -> payment confirmed -> tenant onboarded -> subscription trial/active -> welcome notification queued |
| FLOW-002 | Login and tenant settings hardening | auth, tenant | unauthenticated -> logged in -> role checked -> settings changed -> other tenant denied |
| FLOW-003 | Inbound message to AI response with quota | messaging, ai, billing, agent-rules, contact | webhook received -> contact/conversation ensured -> quota checked -> prompt built -> AI response queued -> usage recorded -> duplicate webhook ignored |
| FLOW-004 | Catalog to paid commerce order | catalog, inventory, commerce, sales, payment, messaging | item created -> stock synced -> cart started -> coupon applied -> checkout/payment link -> webhook paid -> order fulfilled -> notification sent |
| FLOW-005 | Scheduling reservation with payment and reminders | scheduling, payment, alerts, messaging | availability set -> slot reserved -> payment link generated -> payment confirmed -> calendar sync -> reminder queued -> expired reservation ignored |
| FLOW-006 | Prospecting campaign compliance loop | prospecting, contact, messaging, billing | search/import -> campaign activated -> dispatch respects daily limit -> response captured -> opt-out blocks future dispatch |
| FLOW-007 | Recovery recurring charge | recovery, payment, messaging, sales | case created -> guidance generated -> recurring charge scheduled -> due event processed -> payment confirmed -> case marked paid -> revenue classified as recovered |
| FLOW-008 | Proposal lifecycle | proposal, messaging, storage | draft created -> PDF generated -> scheduled -> worker sends public link -> public access opens only valid token -> delete hides it |
| FLOW-009 | Platform admin tenant operation | platform-admin, tenant, billing, messaging | platform key accepted -> tenant overview read -> quota adjusted -> audit/correlation emitted -> tenant user denied |
| FLOW-010 | Dashboard commercial metrics | dashboard, sales, recovery | paid links + paid recovery cases -> source data separates new revenue and recovered revenue -> date filters and tenant isolation hold |

## Module backlog

### agent-rules

Domain guarantee: each tenant has isolated agent-rule drafts, previews, impact analysis, publication history, and AI-facing active rules.

Current tests: `agentRuleDraft.spec.ts`, `agent-rules.e2e-spec.ts`, `agent-rules-impact.e2e-spec.ts`.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| AGENT-G-001 | P0 | Try every REST route with OWNER, ADMIN, MEMBER, and another tenant | Role and tenant isolation are not accidental |
| AGENT-G-002 | P0 | Publish rule version A, publish version B, then request history and active rule | History is immutable and active pointer is correct |
| AGENT-G-003 | P1 | Preview malformed/dangerous draft content with known conversations | Preview is safe, bounded, and never writes production state |

End-to-end state flow: draft -> preview -> impact -> publish -> active rule consumed by AI -> history remains readable.

### ai

Domain guarantee: AI generation uses the right context, respects safety/handoff policy, records usage, and degrades safely when providers fail.

Current tests: broad service, handler, adapter, prompt, media, Redis, and e2e coverage.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| AI-G-001 | P0 | Provider timeout/error during response generation with a real handler fake | No hallucinated response is sent and failure is observable |
| AI-G-002 | P0 | Safety gate blocks sensitive or out-of-policy answer before queueing outbound message | Unsafe content does not leave the system |
| AI-G-003 | P1 | Prompt context truncation with long history, media, commerce, and scheduling context | Token limits keep required facts and drop low-value data |

End-to-end state flow: message received -> context providers resolve -> safety/quota check -> provider call -> response event -> messaging queue.

### alerts

Domain guarantee: reminders are scheduled once, sent at the intended local time, and retries do not duplicate user messages.

Current tests: schedule/body helpers plus create/process use cases.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| ALT-G-001 | P0 | AppModule e2e for create/list/update/delete reminder with tenant auth | API contract and tenant isolation hold |
| ALT-G-002 | P0 | Process same reminder twice under retry | Idempotency prevents duplicate sends |
| ALT-G-003 | P1 | Fake timer around Sao_Paulo midnight and weekend boundaries | Time windows are stable |

End-to-end state flow: reminder created -> scheduled -> due -> message queued -> processed mark prevents second send.

### auth

Domain guarantee: sessions, refresh tokens, reset flows, throttling, and current-user responses remain confidential and predictable.

Current tests: use cases, JWT, Redis session store, throttling helpers, auth e2e, reset e2e, edge e2e.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| AUTH-G-001 | P0 | Refresh token reuse after logout and after rotation | Revoked sessions fail closed |
| AUTH-G-002 | P0 | Rate limit matrix for IP, device id, missing device id, and reset routes | Abuse protection cannot be bypassed by one identifier |
| AUTH-G-003 | P1 | Cookie flags per NODE_ENV production/staging/test | Browser security contract stays explicit |

End-to-end state flow: login -> access protected route -> refresh -> logout -> refresh denied -> current user denied.

### billing

Domain guarantee: subscriptions, quotas, usage records, plan changes, catalog benefits, and billing events are financially consistent and tenant-scoped.

Current tests: domain entities, use cases, processors, event handlers, repository integration, billing e2e, usage controller e2e.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| BILL-G-001 | P0 | Parallel `RecordUsage` calls at exact quota boundary | No quota overspend under race |
| BILL-G-002 | P0 | Downgrade/upgrade/cancel while usage exists and modules are replaced | Plan state and module entitlements remain coherent |
| BILL-G-003 | P1 | Usage export CSV with large values, decimals, and special characters | Audit export is stable |

End-to-end state flow: subscription created -> usage recorded -> quota checked -> plan changed -> usage queried/exported -> cancellation blocks entitlement.

### catalog

Domain guarantee: catalog categories/items are valid, tenant-scoped, importable, reportable, and synchronized with inventory without SKU corruption.

Current tests: one e2e and `CreateCatalogItemUseCase.spec.ts`.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| CAT-G-001 | P0 | Unit specs for create/update/deactivate category and item, including duplicate SKU and missing category | Core domain errors are fast and deterministic |
| CAT-G-002 | P0 | Import CSV with partial invalid rows and report job status | Batch import does not lose valid rows or hide invalid rows |
| CAT-G-003 | P1 | Catalog item update triggers expected inventory sync command/event | Cross-module contract is explicit |

End-to-end state flow: category created -> item created -> item listed -> item updated -> report generated -> item deactivated.

### commerce

Domain guarantee: shopping sessions, cart items, coupons, checkout, abandonment, payment events, fulfillment, and reports preserve order state without double charging.

Current tests: focused use cases, payment handler, report CSV, and commerce e2e.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| COM-G-001 | P0 | Parallel add/apply coupon operations on same session | Cart totals and coupon redemptions stay consistent |
| COM-G-002 | P0 | Duplicate and out-of-order payment events for the same order | Paid/failed state cannot regress or double-apply |
| COM-G-003 | P1 | Abandonment touch respects opt-out, cooldown, and max touches | Compliance and user experience are protected |

End-to-end state flow: session started -> item added -> coupon applied -> checkout -> payment event -> fulfillment update -> abandonment ignored once paid.

### contact

Domain guarantee: contact identity, stage, timeline, import/export, and delete behavior are tenant-scoped and auditable.

Current tests: CRUD/use cases, repositories, domain publisher, contact e2e, controller e2e, timeline e2e.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| CON-G-001 | P0 | Identify same phone/email through messaging and manual contact creation | Identity merge rules do not duplicate people |
| CON-G-002 | P0 | Timeline ordering with same timestamp and mixed event types | UI history is deterministic |
| CON-G-003 | P1 | Import contacts with duplicate rows and invalid fields | Import feedback is actionable and safe |

End-to-end state flow: contact identified -> contact updated -> stage changed -> timeline event emitted -> contact listed -> delete/soft-delete policy applied.

### dashboard

Domain guarantee: dashboard metrics are derived from source modules without mixing revenue classes, tenants, statuses, or date windows.

Current tests: `dashboard-commercial-metrics.e2e-spec.ts`.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| DASH-G-001 | P0 | Same sales/recovery records in two tenants, one authenticated user | Dashboard source data cannot leak cross-tenant |
| DASH-G-002 | P0 | Paid, pending, expired, refunded, and recovered revenue in one date window | Metrics classify only eligible states |
| DASH-G-003 | P1 | Boundary dates around Sao_Paulo start/end of day | Charts do not shift revenue between days |

End-to-end state flow: source records created -> sales summary read -> recovery cases read -> derived metric calculated -> filters and tenant isolation verified.

### inventory

Domain guarantee: inventory connections and item syncs are provider-aware, tenant-scoped, idempotent, and safe under partial provider failure.

Current tests: provider factory, Bling provider, create/sync connection, sync item, worker, inventory e2e.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| INV-G-001 | P0 | Provider DTO/sourceType matrix for BLING, TINY, WOOCOMMERCE, MANUAL | Product API matches provider factory |
| INV-G-002 | P0 | Provider returns 401, 429, malformed JSON, and partial page failure | External failures produce stable states |
| INV-G-003 | P1 | Manual sync endpoint with another tenant connection id | No IDOR on inventory sync |

End-to-end state flow: connection created -> provider validated -> sync started -> items upserted -> syncedAt updated only after successful batch -> report generated.

### messaging

Domain guarantee: inbound/outbound messages, webhooks, conversations, follow-ups, realtime, AI integration, billing quotas, and commerce/sales/scheduling handlers are idempotent and ordered enough for the inbox.

Current tests: broad use case, adapter, worker, handler, repository, and e2e coverage.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| MSG-G-001 | P0 | Golden-file webhook payload matrix per provider/version | Partner payload drift is caught before production |
| MSG-G-002 | P0 | Out-of-order inbound delivery and duplicate message id | Conversation history stays deterministic |
| MSG-G-003 | P1 | Adapter circuit-breaker/retry behavior with queue failure | Provider incidents do not create ghost sends |

End-to-end state flow: webhook received -> receipt stored -> contact/conversation ensured -> AI/human branch -> outbound queued -> status/read/sale attribution updated.

### payment

Domain guarantee: PSP account bootstrap, trial subscription, payment services, webhooks, guards, and projections are idempotent and financially safe.

Current tests: Asaas adapter/guard, bootstrap/status/initiate/process webhook, service, expiration processor, payment and trial e2e.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| PAY-G-001 | P0 | Duplicate webhook receipt with same provider id and different delivery id | Receipt idempotency blocks double projection |
| PAY-G-002 | P0 | Out-of-order paid/refunded/failed events | Terminal state transitions are explicit |
| PAY-G-003 | P1 | Monetary value as Decimal/string/number across adapters | Currency precision is preserved |

End-to-end state flow: account bootstrapped -> payment intent/link created -> webhook verified -> projection emitted -> dependent module updates once.

### platform-admin

Domain guarantee: global admin operations can inspect or modify tenants only through explicit platform credentials, with auditability and no tenant-user bypass.

Current tests: API key guard, tenant overview read DAO, quota adjustment use case.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| PADM-G-001 | P0 | AppModule e2e for every route with no key, bad key, tenant cookie, and platform key | Admin boundary is hard |
| PADM-G-002 | P0 | Quota adjustment creates audit/correlation metadata and changes billing read model | Support operations are traceable |
| PADM-G-003 | P1 | Manual WhatsApp message draft/send with malformed target tenant | No cross-tenant operational mistake |

End-to-end state flow: platform auth accepted -> tenant overview read -> admin action requested -> audit emitted -> target module state updated.

### proposal

Domain guarantee: proposals keep valid totals and lifecycle status, generate PDFs, schedule delivery, send public links through messaging, and protect public access tokens.

Current tests: entity, integration use cases/services, public service/controller, proposal e2e.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| PROP-G-001 | P0 | AppModule/auth e2e or explicit internal-route test for tenantId in body/query | Tenant cannot create/list arbitrary proposals |
| PROP-G-002 | P0 | Public link tamper, expiry, deleted proposal, and wrong token | Public access is safe |
| PROP-G-003 | P1 | Storage upload failure and queue duplicate job id | PDF/delivery can retry without corrupting proposal state |

End-to-end state flow: draft -> PDF generated -> updated -> scheduled -> worker sends link -> public link opened -> deleted proposal hidden.

### prospecting

Domain guarantee: outbound prospecting obeys consent/opt-out, campaign state, daily dispatch limits, external search/import adapters, and reporting.

Current tests: broad use case/controller/entity/repository/provider coverage, reports/search e2e, campaign suggestion e2e.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| PROS-G-001 | P0 | Worker smoke for dispatch under daily limit and opt-out | Compliance holds in async execution |
| PROS-G-002 | P0 | Campaign activation/pause/start transitions with pending executions | State machine cannot send after pause |
| PROS-G-003 | P1 | Google/website enrichment adapter failure matrix | External data gaps are explicit |

End-to-end state flow: search created -> results imported/selected -> campaign created -> activated -> execution dispatched -> response/stop registered -> reports generated.

### recovery

Domain guarantee: recovery cases, playbooks, AI guidance, outreach, replies, recurring charges, and payment events recover revenue without violating opt-out or duplicate charging.

Current tests: generator/services/use cases/handler/reply policy plus recovery e2e.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| REC-G-001 | P0 | Payment event paid/refunded after recurring charge due | Recovery case revenue state is correct |
| REC-G-002 | P0 | Reply with opt-out intent before scheduled outreach | Messaging stops before next touch |
| REC-G-003 | P1 | Playbook template escaping with user-provided fields | Prompt/message injection risk is reduced |

End-to-end state flow: case created -> playbook selected -> outreach/guidance generated -> reply processed -> recurring charge due -> payment event -> case closed/paid.

### sales

Domain guarantee: coupons, promotions, payment links, split charges, metrics, analytics handlers, and reports are financially auditable.

Current tests: entities, use cases, repository, analytics handler, report builder, sales e2e, controller e2e, commerce coupon e2e.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| SAL-G-001 | P0 | Parallel coupon redeem at usage limit | No double-redeem under race |
| SAL-G-002 | P0 | Payment link pause/resume/delete states across list and metrics | Hidden/inactive links do not count incorrectly |
| SAL-G-003 | P1 | CSV/report locale with BR decimals and special characters | Financial exports are audit-safe |

End-to-end state flow: promotion/coupon created -> payment link created -> coupon redeemed -> metric tracked -> payment event/analytics -> report generated.

### scheduling

Domain guarantee: professionals, categories, availability, reservations, recurrences, Google Calendar/Meet, payment links, reminders, and expiration avoid double booking.

Current tests: reservation expiration, recurring processor, Google status/sync service, payment handler, reminder processor, scheduling e2e, Google live e2e.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| SCH-G-001 | P0 | Parallel reserve same slot for same professional | Double booking is impossible or deterministically rejected |
| SCH-G-002 | P0 | Google token revoked/rate limited while confirming reservation | Local reservation state and retry policy are explicit |
| SCH-G-003 | P1 | Recurrence across month end and timezone boundary | Long-running schedules do not drift |

End-to-end state flow: availability set -> slot reserved -> payment/calendar confirmed -> reminder queued -> reschedule/cancel/expire path verified.

### social

Domain guarantee: social comments/webhooks and auto-reply rules match safely, avoid loops, and respect platform signatures/rate limits.

Current tests: auto-reply engine, rule, webhook.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| SOC-G-001 | P0 | Meta/Instagram webhook signature invalid, replayed, and valid | Webhook surface is safe |
| SOC-G-002 | P0 | Golden payload with comment, reply, mention, and unsupported event | Payload drift is caught |
| SOC-G-003 | P1 | Multiple auto-reply rules with priority/cooldown | Bot does not spam or loop |

End-to-end state flow: webhook verified -> comment stored/listed -> rule matched -> reply sent -> duplicate/reply-to-self ignored.

### support

Domain guarantee: support feedback is created, listed, filtered, and protected by tenant/role without leaking PII.

Current tests: create and list use case specs.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| SUP-G-001 | P0 | AppModule e2e for create/list with two tenants | Feedback isolation is guaranteed |
| SUP-G-002 | P0 | Validation for empty message, long text, invalid module, and optional metadata | API returns stable errors |
| SUP-G-003 | P1 | Pagination/filter/sort contract with many feedback records | Support inbox remains usable |

End-to-end state flow: feedback created -> listed by tenant/role -> filtered/paginated -> another tenant denied.

### tenant

Domain guarantee: tenant bootstrap, users, roles, branches, plans, settings, WhatsApp/Meta integrations, promotions, and audits are isolated and recoverable from provider failure.

Current tests: extensive value object/entity/use case/repository/facade/handler/e2e coverage.

| ID | Priority | Test to add | Guarantee |
|----|----------|-------------|-----------|
| TEN-G-001 | P0 | Tenant onboarding triggered from trial payment with provider failure in one downstream dependency | Tenant state is explicit and recoverable |
| TEN-G-002 | P0 | Role matrix across tenant/user/branch/settings/promotion endpoints | No endpoint misses authorization |
| TEN-G-003 | P1 | Fuzz-like value object table for CNPJ, phone, email, company name | Weird user input stays safe |

End-to-end state flow: tenant created -> owner/user created -> branch/settings configured -> integration connected -> plan/status updated -> audit emitted.

## CI gate recommendation

| Gate | Command | Required before merge |
|------|---------|-----------------------|
| Fast unit/integration | `npm test --workspace=src/api -- --runInBand` or targeted Jest path | Every PR touching API code |
| Module e2e smoke | `npm run test:e2e --workspace=src/api -- <module path> --runInBand` | PRs touching controller/flow boundaries |
| Full e2e | `npm run test:e2e --workspace=src/api -- --runInBand` | Release candidate or nightly |
| Live provider tests | Provider-specific scripts/specs with real sandbox env | Nightly/manual, not blocking normal PR unless provider code changed |

## Done criteria for a module

- Domain entities/value objects cover invalid and boundary states.
- Use cases cover success, not found, invalid transition, dependency failure, and idempotency where relevant.
- Controllers cover validation, auth, tenant isolation, response envelope, and error shape.
- Repositories or read DAOs cover tenant filters and important query ordering.
- Async workers/webhooks cover duplicate delivery, retry, and out-of-order events.
- At least one AppModule e2e proves the most important user journey.
