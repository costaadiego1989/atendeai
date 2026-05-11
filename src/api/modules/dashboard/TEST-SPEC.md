# TEST-SPEC - `dashboard`

## Objective

Guarantee dashboard-facing commercial metrics without creating a false source of truth. Today this folder is a cross-module test slice, not a standalone Nest module: it verifies that source data from `sales` and `recovery` lets the frontend separate new-sale revenue from recovered revenue.

## Scenario IDs

Prefix **`DASH-T-NNN`**.

## Current inventory

- E2E: `__tests__/dashboard-commercial-metrics.e2e-spec.ts`
- Current flow covered: authenticated owner reads sales links and recovery cases, then validates `paidRevenue`, recovered revenue, and derived new-sale revenue.

## Priority scenarios

| ID | Type | Scenario | Guarantee |
|----|------|----------|-----------|
| DASH-T-010 | AuthZ | Seed equal records in two tenants and read with one tenant owner | No cross-tenant leakage in metric source data |
| DASH-T-020 | Status | Paid, pending, expired, failed, refunded, and recovered records in same period | Only eligible statuses affect commercial totals |
| DASH-T-030 | Classification | Payment links with `externalId`/`resourceType` for sale vs recovery | New revenue and recovered revenue remain separable |
| DASH-T-040 | Time | Date filters around Sao_Paulo start/end of day | Revenue does not shift between days |
| DASH-T-050 | Contract | Decimal/string/number response summary stays stable | Frontend chart math does not break silently |

## End-to-end state flow

Source records created -> authenticated dashboard source query -> sales summary read -> recovery cases read -> derived metric calculated -> tenant/date/status filters verified.

## Gaps

- **P0:** add a two-tenant negative e2e to the current commercial metrics test.
- **P0:** cover non-paid statuses and refunded/voided payment links so dashboard revenue cannot inflate.
- **P1:** add timezone boundary fixtures for monthly/daily charts.

## Code references

- `modules/dashboard/__tests__/dashboard-commercial-metrics.e2e-spec.ts`
- Source endpoints currently exercised: `sales` links and `recovery` cases.
