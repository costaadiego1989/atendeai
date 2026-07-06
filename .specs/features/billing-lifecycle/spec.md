# Billing Lifecycle — Spec

**Date:** 2026-05-18  
**Status:** Ready for implementation (pending discussion on BL-04)

---

## Scope

Audit and fix the complete billing lifecycle:
1. Trial banner not rendering (confirmed bug)
2. Renewal tests — monthly correct, annual missing
3. Quota regeneration on renewal — logic exists, tests missing
4. Quota exhaustion frontend feedback — partial, needs improvement
5. Annual billing cycle duration — design gap confirmed

---

## Requirements

### BL-01 — Fix TrialBanner isTrial condition [BUG]

**Problem:** `TrialBanner.tsx` uses this condition:
```tsx
const isTrial = !tenant?.plan || tenant?.planStatus === 'TRIALING' || tenant?.planStatus === 'TRIAL' || !tenant?.planStatus;
```
Trial tenants have `plan = 'TRIAL'` and `planStatus = 'ACTIVE'`.
- `!tenant?.plan` → `!('TRIAL')` → `false`
- `planStatus === 'TRIALING'` → false
- `planStatus === 'TRIAL'` → false
- `!tenant?.planStatus` → `!('ACTIVE')` → `false`
- Result: `isTrial = false` → banner returns `null` → **never shows**

**Fix:** Replace with `tenant?.plan === 'TRIAL'`.

**Secondary risk:** If `tenant.createdAt` is not populated by the API session endpoint, `daysLeft` stays `null` (useEffect returns early), also preventing render. Need to verify API returns `createdAt`.

**Files:** `src/app/src/components/TrialBanner.tsx`

---

### BL-02 — Add missing renewal integration tests [TESTS]

**What exists:**
- `BillingPaymentHandlers.spec.ts`: covers monthly renewal, upgrade on payment, idempotency
- `subscription-adjust-quotas.spec.ts`: domain-level adjustQuotas
- `plan-quotas.spec.ts`: business invariant quotas

**What's missing:**
- Test: `renewCycleFrom` on YEARLY billing reference sets `billingCycleEnd` to +12 months
- Test: New `UsageRecord` is created on cycle renewal (quota counter resets)
- Test: Addon package is expired/cleared on renewal (`expireAddonPackageOnRenewal`)
- Test: `billing-upgrade|tenantId|PLAN|YEARLY` reference triggers 12-month cycle

**Note:** These tests are blocked by BL-04 (annual cycle duration design decision).

**Files:** `src/api/modules/billing/__tests__/BillingPaymentHandlers.spec.ts`

---

### BL-03 — Quota exhaustion frontend feedback [ENHANCEMENT]

**What works:**
- `CheckQuotaUseCase` returns `{ canProceed: false, status: 'ACTIVE' }` when quota exhausted
- `BillingUsagePage` shows addon purchase card when usage ≥ 80%
- `useAddonPackageViewModel` + backend full CRUD for addon packages

**What's missing:**
- No global banner/alert when quota is 100% exhausted (only 80% warning shown in billing page)
- No UI feedback when user action fails due to quota (e.g., sending a message that gets blocked)
- The addon purchase is buried in `/billing/usage` — not surfaced at point of failure

**Proposed:** Add quota exhaustion state to `useBillingPageViewModel` and surface a warning banner (similar to TrialBanner) in AppLayout when any quota is ≥ 100%.

**Files:**
- `src/app/src/modules/billing/view-models/useBillingPageViewModel.ts`
- `src/app/src/app/layouts/AppLayout.tsx`
- `src/app/src/components/TrialBanner.tsx` (or new `QuotaBanner.tsx`)

---

### BL-04 — Annual billing cycle duration [DESIGN DECISION NEEDED] ⚠️

**Current behavior:** `Subscription.renewCycleFrom(date)` always sets `billingCycleEnd = date + 1 month`.

**Gap:** No `billingCycleType` field on `Subscription` entity. The system supports annual payment links (`billing-upgrade|tenantId|PLAN|YEARLY`) but after payment confirmation the cycle is still set to 1 month.

**Questions for user before implementing:**
1. Does Asaas charge annual plans as one lump sum or 12 monthly charges?
   - **If lump sum**: `renewCycleFrom` should set +12 months when reference includes `YEARLY`
   - **If 12 monthly charges**: current behavior is correct (Asaas handles each monthly charge)
2. Should the Subscription entity store `billingCycleType` (MONTHLY/ANNUAL)?
3. Should renewal logic parse the `externalReference` to detect annual vs monthly?

**Impact if lump sum:** Need Prisma migration to add `billingCycleType` column.

---

## Summary

| ID | Area | Type | Status |
|----|------|------|--------|
| BL-01 | TrialBanner isTrial condition | Bug fix | **Implement immediately** |
| BL-02 | Renewal tests (monthly confirmed, annual missing) | Tests | Implement after BL-04 |
| BL-03 | Quota exhaustion global banner | Enhancement | Ready to implement |
| BL-04 | Annual billing cycle duration | Design decision | **Needs user input** |

---

## What already works (no action needed)

- Monthly renewal: `BillingPaymentHandlers` renews cycle from `confirmedAt` date ✓
- Quota reset: `UsageRecord.create` on each renewal creates a fresh counter ✓
- Quota check: `CheckQuotaUseCase` blocks operations and emits `BillingQuotaExceededIntegrationEvent` ✓
- Extra quota purchase: Backend + frontend fully wired (`PurchaseAddonPackageUseCase`, `useAddonPackageViewModel`, `BillingUsagePage`) ✓
- Quota warning at 80%: Addon card shown in BillingUsagePage ✓
