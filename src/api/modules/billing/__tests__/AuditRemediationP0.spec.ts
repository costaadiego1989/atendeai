/**
 * Audit Remediation P0 — failing tests first (TDD)
 *
 * Finding 1: billing_cycle_type never persisted nor selected
 * Finding 2: payment.confirmed upgrade has no idempotency guard (paymentId dedup)
 * Finding 3: read-modify-write race on usage counters → incrementUsage
 * Finding 4: YEARLY upgrade creates MONTHLY Asaas charge
 * Finding 5: InitiateTrialSubscriptionUseCase plan trust (unvalidated + force ACTIVE)
 */

import { BillingPaymentHandlers } from '../application/handlers/BillingPaymentHandlers';
import { RecordUsageUseCase } from '../application/use-cases/RecordUsageUseCase';
import { InitiateTrialSubscriptionUseCase } from '../application/use-cases/InitiateTrialSubscriptionUseCase';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '@shared/domain/TenantId';
import { UsageType } from '../application/use-cases/interfaces/IRecordUsageUseCase';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeSubscription(
  plan: 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA' | 'TRIAL' = 'PROFISSIONAL',
  billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY',
) {
  const sub = Subscription.create(TenantId.create('tenant-p0'), plan, {
    billingCycleType: billingCycle,
  });
  sub.updateAsaasCustomer('cus-p0');
  return sub;
}

// ─── Finding 1: billing_cycle_type persisted + selected ─────────────────────

describe('Finding 1 — billing_cycle_type round-trip', () => {
  it('subscriptionToPersistence includes billingCycleType', () => {
    // This import must exist at runtime; if the mapper omits the field the
    // SQL INSERT will silently drop YEARLY and a reload will default to MONTHLY.
    // We verify the mapper produces the field (the SQL fix is in the repository).
    const { BillingMapper } = require('../infrastructure/persistence/mappers/BillingMapper');
    const sub = makeSubscription('PROFISSIONAL', 'YEARLY');
    const data = BillingMapper.subscriptionToPersistence(sub);
    expect(data.billingCycleType).toBe('YEARLY');
  });

  it('PrismaBillingRepository.findSubscription SELECT includes billing_cycle_type', () => {
    // We verify that the raw SQL string in the repository mentions the column.
    // Reading the source at test time gives us a compile-time-safe assertion.
    const fs = require('fs');
    const path = require('path');
    const repoPath = path.resolve(
      __dirname,
      '../infrastructure/persistence/repositories/PrismaBillingRepository.ts',
    );
    const source = fs.readFileSync(repoPath, 'utf-8');

    // The SELECT in findSubscription must list billing_cycle_type
    const findSubscriptionBlock = source.slice(
      source.indexOf('async findSubscription'),
      source.indexOf('async saveSubscription'),
    );
    expect(findSubscriptionBlock).toContain('billing_cycle_type');
  });

  it('PrismaBillingRepository.saveSubscription INSERT lists billing_cycle_type', () => {
    const fs = require('fs');
    const path = require('path');
    const repoPath = path.resolve(
      __dirname,
      '../infrastructure/persistence/repositories/PrismaBillingRepository.ts',
    );
    const source = fs.readFileSync(repoPath, 'utf-8');

    const saveBlock = source.slice(
      source.indexOf('async saveSubscription'),
      source.indexOf('async listPlans'),
    );
    // INSERT column list
    expect(saveBlock).toContain('billing_cycle_type');
    // ON CONFLICT DO UPDATE SET
    const onConflict = saveBlock.slice(saveBlock.indexOf('ON CONFLICT'));
    expect(onConflict).toContain('billing_cycle_type');
  });
});

// ─── Finding 2: payment.confirmed idempotency guard on paymentId ─────────────

describe('Finding 2 — payment.confirmed paymentId dedup', () => {
  let handlers: BillingPaymentHandlers;
  let eventBus: any;
  let billingRepo: any;
  let paymentPort: any;
  let provisioningQueue: any;

  beforeEach(() => {
    eventBus = { subscribe: jest.fn(), publish: jest.fn() };
    billingRepo = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      saveUsage: jest.fn(),
      saveAuditLog: jest.fn(),
      findPlanByCode: jest.fn().mockResolvedValue(null),
      listSubscriptionModules: jest.fn().mockResolvedValue([]),
      findActiveSubscriptionModule: jest.fn().mockResolvedValue(null),
      updateSubscriptionModuleStatus: jest.fn(),
      isPaymentProcessed: jest.fn().mockResolvedValue(false),
      markPaymentProcessed: jest.fn().mockResolvedValue(undefined),
    };
    paymentPort = {
      createSubscription: jest.fn().mockResolvedValue({ subscriptionId: 'sub-new' }),
      updateSubscription: jest.fn(),
    };
    provisioningQueue = { add: jest.fn() };

    handlers = new BillingPaymentHandlers(
      eventBus,
      billingRepo,
      paymentPort,
      provisioningQueue,
    );
    handlers.onModuleInit();
  });

  function getHandler(name: string) {
    return eventBus.subscribe.mock.calls.find((c: any[]) => c[0] === name)[1];
  }

  it('should NOT re-run changePlan+renewCycle on duplicate paymentId for upgrade', async () => {
    // Arrange: first delivery already processed
    billingRepo.isPaymentProcessed.mockResolvedValue(true);

    const sub = makeSubscription('ESSENCIAL');
    billingRepo.findSubscription.mockResolvedValue(sub);

    const handler = getHandler('payment.confirmed');

    await handler({
      payload: {
        tenantId: 'tenant-p0',
        paymentId: 'pay-dup-1',
        amount: 99,
        confirmedAt: new Date().toISOString(),
        rawReference: 'billing-upgrade|tenant-p0|PROFISSIONAL|MONTHLY',
      },
    });

    // No side-effects should run on a duplicate
    expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
    expect(paymentPort.createSubscription).not.toHaveBeenCalled();
  });

  it('should process upgrade on first delivery then mark as processed', async () => {
    billingRepo.isPaymentProcessed.mockResolvedValue(false);

    const sub = makeSubscription('ESSENCIAL');
    billingRepo.findSubscription.mockResolvedValue(sub);

    const handler = getHandler('payment.confirmed');

    await handler({
      payload: {
        tenantId: 'tenant-p0',
        paymentId: 'pay-first-1',
        amount: 99,
        confirmedAt: new Date().toISOString(),
        rawReference: 'billing-upgrade|tenant-p0|PROFISSIONAL|MONTHLY',
      },
    });

    expect(billingRepo.markPaymentProcessed).toHaveBeenCalledWith('pay-first-1');
    expect(billingRepo.saveSubscription).toHaveBeenCalled();
  });
});

// ─── Finding 3: atomic incrementUsage ────────────────────────────────────────

describe('Finding 3 — RecordUsageUseCase uses incrementUsage (atomic)', () => {
  it('should call billingRepository.incrementUsage instead of saveUsage', async () => {
    const billingRepo: any = {
      findSubscription: jest.fn().mockResolvedValue(
        makeSubscription('PROFISSIONAL'),
      ),
      incrementUsage: jest.fn().mockResolvedValue(undefined),
      // saveUsage should NOT be called anymore
      saveUsage: jest.fn(),
      getUsage: jest.fn().mockResolvedValue(null),
    };

    const useCase = new RecordUsageUseCase(billingRepo);
    await useCase.execute({
      tenantId: 'tenant-p0',
      type: UsageType.MESSAGE,
    });

    // Post-fix: incrementUsage is called atomically
    expect(billingRepo.incrementUsage).toHaveBeenCalledWith(
      'tenant-p0',
      'messages',
      1,
    );
    // saveUsage with absolute values must NOT be called (race condition)
    expect(billingRepo.saveUsage).not.toHaveBeenCalled();
  });

  it('IBillingRepository interface must declare incrementUsage', () => {
    const fs = require('fs');
    const path = require('path');
    const ifacePath = path.resolve(
      __dirname,
      '../domain/repositories/IBillingRepository.ts',
    );
    const source = fs.readFileSync(ifacePath, 'utf-8');
    expect(source).toContain('incrementUsage');
  });

  it('PrismaBillingRepository must implement incrementUsage', () => {
    const fs = require('fs');
    const path = require('path');
    const repoPath = path.resolve(
      __dirname,
      '../infrastructure/persistence/repositories/PrismaBillingRepository.ts',
    );
    const source = fs.readFileSync(repoPath, 'utf-8');
    expect(source).toContain('incrementUsage');
    // Must use atomic SQL increment (field + delta pattern), not absolute assignment.
    // The repo uses Prisma.sql column references then + delta — verify the + delta pattern.
    expect(source).toContain('+ ${delta}');
  });
});

// ─── Finding 4: YEARLY upgrade passes billingCycle to syncRecurringBilling ───

describe('Finding 4 — YEARLY upgrade produces YEARLY Asaas charge', () => {
  let handlers: BillingPaymentHandlers;
  let eventBus: any;
  let billingRepo: any;
  let paymentPort: any;
  let provisioningQueue: any;

  beforeEach(() => {
    eventBus = { subscribe: jest.fn(), publish: jest.fn() };
    billingRepo = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      saveUsage: jest.fn(),
      saveAuditLog: jest.fn(),
      findPlanByCode: jest.fn().mockResolvedValue({
        code: 'PROFISSIONAL',
        monthlyPrice: 99,
        messagesQuota: 1000,
        aiTokensQuota: 1000,
        contactsQuota: 1000,
        features: [],
        isStandard: true,
        config: {},
        active: true,
        displayName: 'Profissional',
        sortOrder: 2,
      }),
      listSubscriptionModules: jest.fn().mockResolvedValue([]),
      findActiveSubscriptionModule: jest.fn().mockResolvedValue(null),
      updateSubscriptionModuleStatus: jest.fn(),
      isPaymentProcessed: jest.fn().mockResolvedValue(false),
      markPaymentProcessed: jest.fn().mockResolvedValue(undefined),
    };
    paymentPort = {
      createSubscription: jest.fn().mockResolvedValue({ subscriptionId: 'sub-new' }),
      updateSubscription: jest.fn(),
    };
    provisioningQueue = { add: jest.fn() };

    handlers = new BillingPaymentHandlers(
      eventBus,
      billingRepo,
      paymentPort,
      provisioningQueue,
    );
    handlers.onModuleInit();
  });

  function getHandler(name: string) {
    return eventBus.subscribe.mock.calls.find((c: any[]) => c[0] === name)[1];
  }

  it('should pass YEARLY cycle to createSubscription when reference says YEARLY', async () => {
    const sub = makeSubscription('ESSENCIAL', 'MONTHLY');
    sub.updateAsaasCustomer('cus-p0');
    // No existing asaas subscription so createSubscription will be called
    billingRepo.findSubscription
      .mockResolvedValueOnce(sub)   // first call in confirmed handler
      .mockResolvedValueOnce(sub);  // second call inside syncRecurringBillingAfterUpgrade

    const handler = getHandler('payment.confirmed');

    await handler({
      payload: {
        tenantId: 'tenant-p0',
        paymentId: 'pay-yearly-1',
        amount: 1188,
        confirmedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        rawReference: 'billing-upgrade|tenant-p0|PROFISSIONAL|YEARLY',
      },
    });

    expect(paymentPort.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ cycle: 'YEARLY' }),
    );
  });

  it('nextDueDate for YEARLY upgrade should be +1 year, not +1 month', async () => {
    const sub = makeSubscription('ESSENCIAL', 'MONTHLY');
    sub.updateAsaasCustomer('cus-p0');
    billingRepo.findSubscription
      .mockResolvedValueOnce(sub)
      .mockResolvedValueOnce(sub);

    const handler = getHandler('payment.confirmed');

    await handler({
      payload: {
        tenantId: 'tenant-p0',
        paymentId: 'pay-yearly-2',
        amount: 1188,
        confirmedAt: new Date('2026-01-15T00:00:00.000Z').toISOString(),
        rawReference: 'billing-upgrade|tenant-p0|PROFISSIONAL|YEARLY',
      },
    });

    const call = paymentPort.createSubscription.mock.calls[0][0];
    // nextDueDate must be 2027-01-15, not 2026-02-15
    expect(call.nextDueDate).toBe('2027-01-15');
  });
});

// ─── Finding 5: InitiateTrialSubscriptionUseCase plan validation ──────────────

describe('Finding 5 — InitiateTrialSubscriptionUseCase plan validation', () => {
  function makeUseCase(billingRepo: any) {
    const paymentFacade: any = {
      createCustomer: jest.fn().mockResolvedValue({ id: 'cus-x' }),
    };
    const eventBus: any = { publish: jest.fn() };
    const billingQueue: any = { add: jest.fn() };
    const configService: any = { get: jest.fn().mockReturnValue(168) };

    return new InitiateTrialSubscriptionUseCase(
      paymentFacade,
      eventBus,
      billingQueue,
      configService,
      billingRepo,
    );
  }

  it('should throw BadRequestException for unrecognised plan strings', async () => {
    const billingRepo: any = {
      findSubscription: jest.fn().mockResolvedValue(null),
      saveSubscription: jest.fn(),
      saveUsage: jest.fn(),
      getUsage: jest.fn().mockResolvedValue(null),
    };

    const useCase = makeUseCase(billingRepo);

    await expect(
      useCase.execute({
        tenantId: 'tenant-p0',
        name: 'Test',
        email: 'test@example.com',
        phone: '11999999999',
        companyName: 'Acme',
        plan: 'HACKER',
      }),
    ).rejects.toThrow();

    // Must not have persisted anything
    expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
  });

  it('should NOT force ACTIVE on paid plans (PROFISSIONAL stays PENDING)', async () => {
    const billingRepo: any = {
      findSubscription: jest.fn().mockResolvedValue(null),
      saveSubscription: jest.fn(),
      saveUsage: jest.fn(),
      getUsage: jest.fn().mockResolvedValue(null),
    };

    const useCase = makeUseCase(billingRepo);

    await useCase.execute({
      tenantId: 'tenant-p0',
      name: 'Test',
      email: 'test@example.com',
      phone: '11999999999',
      companyName: 'Acme',
      plan: 'PROFISSIONAL',
    });

    // The subscription passed to saveSubscription must NOT be ACTIVE
    const saved: Subscription = billingRepo.saveSubscription.mock.calls[0][0];
    expect(saved.status).not.toBe('ACTIVE');
  });

  it('should keep ACTIVE status for TRIAL plan', async () => {
    const billingRepo: any = {
      findSubscription: jest.fn().mockResolvedValue(null),
      saveSubscription: jest.fn(),
      saveUsage: jest.fn(),
      getUsage: jest.fn().mockResolvedValue(null),
    };

    const useCase = makeUseCase(billingRepo);

    await useCase.execute({
      tenantId: 'tenant-p0',
      name: 'Test',
      email: 'test@example.com',
      phone: '11999999999',
      companyName: 'Acme',
      plan: 'TRIAL',
    });

    const saved: Subscription = billingRepo.saveSubscription.mock.calls[0][0];
    expect(saved.status).toBe('ACTIVE');
  });

  it('should keep ACTIVE for ESSENCIAL (free-tier)', async () => {
    const billingRepo: any = {
      findSubscription: jest.fn().mockResolvedValue(null),
      saveSubscription: jest.fn(),
      saveUsage: jest.fn(),
      getUsage: jest.fn().mockResolvedValue(null),
    };

    const useCase = makeUseCase(billingRepo);

    await useCase.execute({
      tenantId: 'tenant-p0',
      name: 'Test',
      email: 'test@example.com',
      phone: '11999999999',
      companyName: 'Acme',
      plan: 'ESSENCIAL',
    });

    const saved: Subscription = billingRepo.saveSubscription.mock.calls[0][0];
    expect(saved.status).toBe('ACTIVE');
  });
});
