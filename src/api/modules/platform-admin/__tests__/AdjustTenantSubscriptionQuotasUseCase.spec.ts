import { TenantId } from '@shared/domain/TenantId';
import { Subscription } from '@modules/billing/domain/entities/Subscription';
import { Quotas } from '@modules/billing/domain/value-objects/Quotas';
import { AdjustTenantSubscriptionQuotasUseCase } from '../application/use-cases/AdjustTenantSubscriptionQuotasUseCase';

describe('AdjustTenantSubscriptionQuotasUseCase', () => {
  it('persists adjustments and PLATFORM_QUOTA_ADJUST audit log', async () => {
    const tenantIdStr = '00000000-0000-4000-8000-000000000099';
    const sub = Subscription.create(TenantId.create(tenantIdStr), 'TRIAL', {
      quotas: Quotas.reconstitute(10, 10, 10),
    });
    const billing = {
      findSubscription: jest.fn().mockResolvedValue(sub),
      saveSubscription: jest.fn().mockResolvedValue(undefined),
      saveAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    const uc = new AdjustTenantSubscriptionQuotasUseCase(billing as any);
    await uc.execute({
      tenantId: tenantIdStr,
      messages: 5,
    });
    expect(billing.saveSubscription).toHaveBeenCalled();
    expect(billing.saveAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'PLATFORM_QUOTA_ADJUST',
        tenantId: tenantIdStr,
      }),
    );
  });
});
