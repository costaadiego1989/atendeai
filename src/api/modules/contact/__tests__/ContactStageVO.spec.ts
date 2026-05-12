import { ContactStageVO } from '../domain/value-objects/ContactStage';

describe('ContactStageVO (Value Object)', () => {
  it('should create with valid stages', () => {
    const stages = ['LEAD', 'PROSPECT', 'OPPORTUNITY', 'CUSTOMER', 'INACTIVE'];

    for (const stage of stages) {
      const vo = ContactStageVO.create(stage);
      expect(vo.value).toBe(stage);
    }
  });

  it('should reject invalid stage', () => {
    expect(() => ContactStageVO.create('INVALID')).toThrow(
      'Invalid contact stage: INVALID',
    );
    expect(() => ContactStageVO.create('RANDOM')).toThrow(
      'Invalid contact stage: RANDOM',
    );
  });

  it('should default to LEAD when no value is provided', () => {
    const vo = ContactStageVO.create();
    expect(vo.value).toBe('LEAD');
  });

  it('should determine equality between two ContactStageVO instances', () => {
    const stage1 = ContactStageVO.create('LEAD');
    const stage2 = ContactStageVO.create('LEAD');
    const stage3 = ContactStageVO.create('PROSPECT');

    expect(stage1.equals(stage2)).toBe(true);
    expect(stage1.equals(stage3)).toBe(false);
  });

  it('should expose helper methods for stage checks', () => {
    const lead = ContactStageVO.create('LEAD');
    const prospect = ContactStageVO.create('PROSPECT');
    const opportunity = ContactStageVO.create('OPPORTUNITY');
    const customer = ContactStageVO.create('CUSTOMER');

    expect(lead.isLead()).toBe(true);
    expect(lead.isProspect()).toBe(false);

    expect(prospect.isProspect()).toBe(true);
    expect(prospect.isLead()).toBe(false);

    expect(opportunity.isOpportunity()).toBe(true);
    expect(customer.isCustomer()).toBe(true);
  });
});
