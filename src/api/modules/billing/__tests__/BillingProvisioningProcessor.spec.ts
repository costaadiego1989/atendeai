import { TenantId } from '@shared/domain/TenantId';
import { BillingProvisioningProcessor } from '../application/processors/BillingProvisioningProcessor';
import { Subscription } from '../domain/entities/Subscription';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { BillingSubscriptionProvisionedIntegrationEvent } from '../application/integration-events/BillingIntegrationEvents';

describe('BillingProvisioningProcessor', () => {
  let processor: BillingProvisioningProcessor;
  let billingRepo: any;
  let tenantQueryPort: any;
  let paymentPort: any;
  let eventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    billingRepo = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      findPlanByCode: jest.fn(),
      listSubscriptionModules: jest.fn().mockResolvedValue([]),
    };
    tenantQueryPort = {
      findTenantById: jest.fn(),
      findTenantPlan: jest.fn(),
      updateTenantPlan: jest.fn(),
    };
    paymentPort = {
      createCustomer: jest.fn(),
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      createPaymentLink: jest.fn(),
    };
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    } as any;
    processor = new BillingProvisioningProcessor(
      billingRepo,
      tenantQueryPort,
      paymentPort,
      eventBus,
    );
  });

  it('should provision only customer for ESSENCIAL plan', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    billingRepo.findSubscription.mockResolvedValue(sub);
    paymentPort.createCustomer.mockResolvedValue({ customerId: 'cus_1' });

    await processor.process({
      data: {
        tenantId: 't1',
        plan: 'ESSENCIAL',
        ownerName: 'Owner',
        ownerEmail: 'owner@test.com',
        cnpj: '11.444.777/0001-61',
        ownerPhone: '11999999999',
      },
    } as any);

    expect(paymentPort.createCustomer).toHaveBeenCalled();
    expect(paymentPort.createSubscription).not.toHaveBeenCalled();
    expect(sub.asaasCustomerId).toBe('cus_1');
  });

  it('should provision both customer and subscription sequentially', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    billingRepo.findSubscription.mockResolvedValue(sub);

    paymentPort.createCustomer.mockResolvedValue({ customerId: 'cus_1' });
    paymentPort.createSubscription.mockResolvedValue({
      subscriptionId: 'sub_1',
    });
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      monthlyPrice: 297,
    });

    await processor.process({
      data: {
        tenantId: 't1',
        plan: 'PROFISSIONAL',
        ownerName: 'Owner',
        ownerEmail: 'owner@test.com',
        cnpj: '11.444.777/0001-61',
        ownerPhone: '11999999999',
      },
    } as any);

    expect(paymentPort.createCustomer).toHaveBeenCalled();
    expect(paymentPort.createSubscription).toHaveBeenCalled();
    expect(sub.asaasCustomerId).toBe('cus_1');
    expect(sub.asaasSubscriptionId).toBe('sub_1');
    expect(billingRepo.saveSubscription).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(BillingSubscriptionProvisionedIntegrationEvent),
    );
  });

  it('should skip customer creation if already exists', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    sub.updateAsaasCustomer('cus_existing');
    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      monthlyPrice: 297,
    });

    paymentPort.createSubscription.mockResolvedValue({
      subscriptionId: 'sub_1',
    });

    await processor.process({
      data: { tenantId: 't1', plan: 'PROFISSIONAL' },
    } as any);

    expect(paymentPort.createCustomer).not.toHaveBeenCalled();
    expect(paymentPort.createSubscription).toHaveBeenCalled();
    expect(sub.asaasCustomerId).toBe('cus_existing');
    expect(sub.asaasSubscriptionId).toBe('sub_1');
  });

  it('should load tenant data from repository when queue payload is partial', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    billingRepo.findSubscription.mockResolvedValue(sub);
    tenantQueryPort.findTenantById.mockResolvedValue({
      plan: 'PROFISSIONAL',
      owner: {
        name: 'Owner Repo',
        email: 'repo@test.com',
        phone: '11999999999',
      },
      cnpj: '11.444.777/0001-61',
    });
    paymentPort.createCustomer.mockResolvedValue({ customerId: 'cus_1' });
    paymentPort.createSubscription.mockResolvedValue({
      subscriptionId: 'sub_1',
    });
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      monthlyPrice: 297,
    });
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      monthlyPrice: 297,
    });

    await processor.process({
      data: { tenantId: 't1', plan: 'PROFISSIONAL' },
    } as any);

    expect(tenantQueryPort.findTenantById).toHaveBeenCalledWith('t1');
    expect(paymentPort.createCustomer).toHaveBeenCalled();
    expect(paymentPort.createSubscription).toHaveBeenCalled();
  });

  it('should fall back to PROVISIONING_FAILED if max attempts reached', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      monthlyPrice: 297,
    });

    paymentPort.createCustomer.mockRejectedValue(new Error('Fatal'));

    // opts.attempts = 3, attemptsMade = 2 -> meaning it failed the 3rd attempt
    const job = {
      data: {
        tenantId: 't1',
        plan: 'PROFISSIONAL',
        ownerName: 'Owner',
        ownerEmail: 'owner@test.com',
        cnpj: '11.444.777/0001-61',
        ownerPhone: '11999999999',
      },
      opts: { attempts: 3 },
      attemptsMade: 2,
    } as any;

    await expect(processor.process(job)).rejects.toThrow('Fatal');

    expect(sub.status).toBe('PROVISIONING_FAILED');
    expect(billingRepo.saveSubscription).toHaveBeenCalledTimes(1);
  });

  it('should skip provisioning when subscription is already ACTIVE with asaasCustomerId', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    sub.updateAsaasInfo('cus_existing', 'sub_existing');
    sub.activate();
    billingRepo.findSubscription.mockResolvedValue(sub);

    await processor.process({
      data: {
        tenantId: 't1',
        plan: 'PROFISSIONAL',
        ownerName: 'Owner',
        ownerEmail: 'owner@test.com',
        cnpj: '11.444.777/0001-61',
        ownerPhone: '11999999999',
      },
    } as any);

    expect(paymentPort.createCustomer).not.toHaveBeenCalled();
    expect(paymentPort.createSubscription).not.toHaveBeenCalled();
    expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
  });

  it('should NOT mark as PROVISIONING_FAILED if subscription is already ACTIVE', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    sub.activate();
    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      monthlyPrice: 297,
    });

    // Simulate: subscription is ACTIVE but processor still runs (race condition)
    // The early return catches it, but if somehow it gets past (e.g., status changed mid-flight),
    // the error handler should NOT overwrite ACTIVE status
    paymentPort.createCustomer.mockRejectedValue(new Error('Conflict'));

    const job = {
      data: {
        tenantId: 't1',
        plan: 'PROFISSIONAL',
        ownerName: 'Owner',
        ownerEmail: 'owner@test.com',
        cnpj: '11.444.777/0001-61',
        ownerPhone: '11999999999',
      },
      opts: { attempts: 3 },
      attemptsMade: 2,
    } as any;

    // The early return should prevent reaching createCustomer since sub is ACTIVE + has customerId
    // But let's test the error handler path by removing the customerId so it passes the early return
    const sub2 = Subscription.create(TenantId.create('t2'), 'PROFISSIONAL');
    sub2.activate(); // ACTIVE but no asaasCustomerId — passes early return
    billingRepo.findSubscription.mockResolvedValue(sub2);

    const job2 = {
      data: {
        tenantId: 't2',
        plan: 'PROFISSIONAL',
        ownerName: 'Owner',
        ownerEmail: 'owner@test.com',
        cnpj: '11.444.777/0001-61',
        ownerPhone: '11999999999',
      },
      opts: { attempts: 3 },
      attemptsMade: 2,
    } as any;

    await expect(processor.process(job2)).rejects.toThrow('Conflict');

    expect(sub2.status).toBe('ACTIVE');
    expect(billingRepo.saveSubscription).not.toHaveBeenCalled();
  });
});
