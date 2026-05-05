import { TenantId } from '@shared/domain/TenantId';
import { BillingProvisioningProcessor } from '../application/processors/BillingProvisioningProcessor';
import { Subscription } from '../domain/entities/Subscription';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { BillingSubscriptionProvisionedIntegrationEvent } from '../application/integration-events/BillingIntegrationEvents';

describe('BillingProvisioningProcessor', () => {
  let processor: BillingProvisioningProcessor;
  let billingRepo: any;
  let tenantRepository: any;
  let paymentGateway: any;
  let eventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    billingRepo = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      findPlanByCode: jest.fn(),
    };
    tenantRepository = { findById: jest.fn() };
    paymentGateway = {
      createCustomer: jest.fn(),
      createSubaccount: jest.fn(),
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      getSubscription: jest.fn(),
      createPayment: jest.fn(),
      deletePayment: jest.fn(),
      restorePayment: jest.fn(),
      createPaymentLink: jest.fn(),
      removePaymentLink: jest.fn(),
      restorePaymentLink: jest.fn(),
      parseWebhook: jest.fn(),
    };
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    } as any;
    processor = new BillingProvisioningProcessor(
      billingRepo,
      tenantRepository,
      paymentGateway,
      eventBus,
    );
  });

  it('should provision only customer for ESSENCIAL plan', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    billingRepo.findSubscription.mockResolvedValue(sub);
    paymentGateway.createCustomer.mockResolvedValue({ id: 'cus_1' });

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

    expect(paymentGateway.createCustomer).toHaveBeenCalled();
    expect(paymentGateway.createSubscription).not.toHaveBeenCalled();
    expect(sub.asaasCustomerId).toBe('cus_1');
  });

  it('should provision both customer and subscription sequentially', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    billingRepo.findSubscription.mockResolvedValue(sub);

    paymentGateway.createCustomer.mockResolvedValue({ id: 'cus_1' });
    paymentGateway.createSubscription.mockResolvedValue({
      id: 'sub_1',
      status: 'ACTIVE',
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

    expect(paymentGateway.createCustomer).toHaveBeenCalled();
    expect(paymentGateway.createSubscription).toHaveBeenCalled();
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

    paymentGateway.createSubscription.mockResolvedValue({
      id: 'sub_1',
      status: 'ACTIVE',
    });

    await processor.process({
      data: { tenantId: 't1', plan: 'PROFISSIONAL' },
    } as any);

    expect(paymentGateway.createCustomer).not.toHaveBeenCalled();
    expect(paymentGateway.createSubscription).toHaveBeenCalled();
    expect(sub.asaasCustomerId).toBe('cus_existing');
    expect(sub.asaasSubscriptionId).toBe('sub_1');
  });

  it('should load tenant data from repository when queue payload is partial', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    billingRepo.findSubscription.mockResolvedValue(sub);
    tenantRepository.findById.mockResolvedValue({
      cnpj: { value: '11.444.777/0001-61' },
      owner: {
        name: 'Owner Repo',
        email: { value: 'repo@test.com' },
        phone: { value: '11999999999' },
      },
    });
    paymentGateway.createCustomer.mockResolvedValue({ id: 'cus_1' });
    paymentGateway.createSubscription.mockResolvedValue({
      id: 'sub_1',
      status: 'ACTIVE',
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

    expect(tenantRepository.findById).toHaveBeenCalledWith('t1');
    expect(paymentGateway.createCustomer).toHaveBeenCalled();
    expect(paymentGateway.createSubscription).toHaveBeenCalled();
  });

  it('should fall back to PROVISIONING_FAILED if max attempts reached', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      monthlyPrice: 297,
    });

    paymentGateway.createCustomer.mockRejectedValue(new Error('Fatal'));

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
});
