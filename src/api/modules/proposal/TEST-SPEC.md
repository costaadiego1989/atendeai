# TEST-SPEC - `proposal`

## Objective

Guarantee the full proposal lifecycle: draft creation, item totals, PDF generation, scheduling, delivery through messaging, public link access, deletion, and tenant isolation.

## Scenario IDs

Prefix **`PROP-T-NNN`**.

## Current inventory

- Domain: `domain/entities/__tests__/Proposal.spec.ts`
- Integration: `__tests__/integration/*.spec.ts`
- E2E: `__tests__/e2e/Proposal.e2e-spec.ts`
- Public API: `__tests__/e2e/PublicProposalController.spec.ts`
- Utility/fakes: `__tests__/proposal-test-utils.ts`

Note: there is also a legacy-looking folder `__tests/integration` without the double trailing underscore. Normalize future proposal tests under `__tests__` unless there is a deliberate reason to keep both.

## Priority scenarios

| ID | Type | Scenario | Guarantee |
|----|------|----------|-----------|
| PROP-T-010 | Validation | Empty items, short title, invalid quantity, invalid unit price, invalid schedule date | Domain and API reject invalid proposal state |
| PROP-T-020 | Success | Create -> generate PDF -> get/list -> update -> schedule -> worker send -> delete | Main lifecycle stays connected |
| PROP-T-030 | Status | DRAFT, SCHEDULED, SENT, ACCEPTED, REJECTED, EXPIRED, CANCELLED transitions | Illegal transitions cannot corrupt lifecycle |
| PROP-T-040 | AuthZ | Authenticated user attempts create/list/get using another tenantId | Tenant cannot operate another tenant proposal |
| PROP-T-050 | Public access | Tampered token, expired token, deleted proposal, wrong proposal id | Public proposal links are safe |
| PROP-T-060 | Infra | Storage upload failure and duplicate queue job id | PDF/delivery failures can retry without duplicate sends |

## End-to-end state flow

Draft created -> PDF generated and persisted -> proposal updated -> scheduled with queue job -> worker sends public link through messaging -> public link opens valid proposal -> delete hides future reads.

## Gaps

- **P0:** run a proposal e2e through `AppModule` or explicitly document the controller as internal; current controller accepts `tenantId` in body/query and the isolated e2e does not prove auth/tenant guards.
- **P0:** add public link tamper/expiry/deleted-proposal tests.
- **P1:** add PDF generation snapshot/contract tests for monetary totals and item rendering.
- **P1:** add queue idempotency test for repeated `send-proposal-{proposalId}` jobs.

## Code references

- `proposal.module.ts`
- `presentation/controllers/ProposalController.ts`
- `presentation/controllers/PublicProposalController.ts`
- `domain/entities/Proposal.ts`
- `application/use-cases/*Proposal*UseCase.ts`
- `infrastructure/queue/ProposalAsyncJobProcessor.ts`
