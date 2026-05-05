import { TenantId } from '@shared/domain/TenantId';
import { Subscription } from '../domain/entities/Subscription';
import { Quotas } from '../domain/value-objects/Quotas';

describe('Subscription.adjustQuotas', () => {
  it('adds positive deltas to current quotas', () => {
    const sub = Subscription.create(
      TenantId.create('00000000-0000-4000-8000-000000000001'),
      'TRIAL',
      {
        quotas: Quotas.reconstitute(10, 20, 30),
      },
    );
    sub.adjustQuotas({ messages: 5, aiTokens: 100, contacts: 2 });
    expect(sub.quotas.messages).toBe(15);
    expect(sub.quotas.aiTokens).toBe(120);
    expect(sub.quotas.contacts).toBe(32);
  });

  it('rejects negative resulting quota', () => {
    const sub = Subscription.create(
      TenantId.create('00000000-0000-4000-8000-000000000002'),
      'TRIAL',
      {
        quotas: Quotas.reconstitute(5, 5, 5),
      },
    );
    expect(() => sub.adjustQuotas({ messages: -10 })).toThrow();
  });
});
