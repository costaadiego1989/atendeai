import { AgentRegistry } from '../AgentRegistry';

describe('AgentRegistry', () => {
  describe('getByBusinessType', () => {
    it('recovery → RecoveryAgent', () => {
      expect(AgentRegistry.getByBusinessType('recovery').id).toBe('recovery');
    });

    it('clinic → SchedulingAgent', () => {
      expect(AgentRegistry.getByBusinessType('clinic').id).toBe('scheduling');
    });

    it('salon → SchedulingAgent', () => {
      expect(AgentRegistry.getByBusinessType('salon').id).toBe('scheduling');
    });

    it('restaurant → CommerceAgent', () => {
      expect(AgentRegistry.getByBusinessType('restaurant').id).toBe('commerce');
    });

    it('ecommerce → SalesAgent', () => {
      expect(AgentRegistry.getByBusinessType('ecommerce').id).toBe('sales');
    });

    it('generic → SalesAgent', () => {
      expect(AgentRegistry.getByBusinessType('generic').id).toBe('sales');
    });

    it('unknown type → SalesAgent (fallback)', () => {
      expect(
        AgentRegistry.getByBusinessType('unknown' as any).id,
      ).toBe('sales');
    });
  });

  describe('getByIntent', () => {
    it('COMPLAINT → SupportAgent', () => {
      expect(AgentRegistry.getByIntent('COMPLAINT')?.id).toBe('support');
    });

    it('PURCHASE → null (no intent override for purchase)', () => {
      expect(AgentRegistry.getByIntent('PURCHASE')).toBeNull();
    });

    it('UNKNOWN → null', () => {
      expect(AgentRegistry.getByIntent('UNKNOWN')).toBeNull();
    });
  });

  describe('getById', () => {
    it('returns agent by id', () => {
      expect(AgentRegistry.getById('recovery').name).toBe('Recovery Agent');
    });

    it('throws for invalid id', () => {
      expect(() => AgentRegistry.getById('nonexistent')).toThrow(
        /Agent not found/,
      );
    });
  });

  describe('getDefault', () => {
    it('returns SalesAgent', () => {
      expect(AgentRegistry.getDefault().id).toBe('sales');
    });
  });

  describe('getAll', () => {
    it('returns 5 agents', () => {
      expect(AgentRegistry.getAll()).toHaveLength(5);
    });

    it('includes all agent ids', () => {
      const ids = AgentRegistry.getAll().map((a) => a.id);
      expect(ids).toContain('sales');
      expect(ids).toContain('recovery');
      expect(ids).toContain('scheduling');
      expect(ids).toContain('commerce');
      expect(ids).toContain('support');
    });
  });
});
