import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '@shared/domain/TenantId';

describe('Subscription', () => {
  it('should create an active TRIAL subscription by default', () => {
    const subscription = Subscription.create(TenantId.create('tenant-1'));

    expect(subscription.plan).toBe('TRIAL');
    expect(subscription.status).toBe('ACTIVE');
  });

  it('should activate and mark the subscription as overdue', () => {
    const subscription = Subscription.create(
      TenantId.create('tenant-1'),
      'PROFISSIONAL',
    );

    subscription.activate();
    expect(subscription.status).toBe('ACTIVE');

    subscription.markAsOverdue();
    expect(subscription.status).toBe('OVERDUE');
  });

  it('should renew the billing cycle from the provided reference date', () => {
    const subscription = Subscription.create(TenantId.create('tenant-1'));
    const referenceDate = new Date('2026-02-15T00:00:00.000Z');

    subscription.renewCycleFrom(referenceDate);

    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.billingCycleStart.toISOString()).toBe(
      '2026-02-15T00:00:00.000Z',
    );
    expect(subscription.billingCycleEnd.toISOString()).toBe(
      '2026-03-15T00:00:00.000Z',
    );
  });

  it('should report whether a date is inside the current cycle', () => {
    const subscription = Subscription.create(TenantId.create('tenant-1'));
    subscription.renewCycleFrom(new Date('2026-02-01T00:00:00.000Z'));

    expect(
      subscription.isInCurrentCycle(new Date('2026-02-10T00:00:00.000Z')),
    ).toBe(true);
    expect(
      subscription.isInCurrentCycle(new Date('2026-03-10T00:00:00.000Z')),
    ).toBe(false);
  });

  it('should change the plan and refresh quotas', () => {
    const subscription = Subscription.create(TenantId.create('tenant-1'));

    subscription.changePlan('PROFISSIONAL');

    expect(subscription.plan).toBe('PROFISSIONAL');
    expect(subscription.quotas.messages).toBe(75000);
    expect(subscription.quotas.aiTokens).toBe(7500000);
    expect(subscription.quotas.contacts).toBe(2500);
  });
});
