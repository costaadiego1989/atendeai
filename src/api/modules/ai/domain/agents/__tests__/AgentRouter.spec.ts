import { AgentRouter } from '../AgentRouter';
import type { AgentRoutingInput } from '../AgentRouter';

describe('AgentRouter', () => {
  let router: AgentRouter;

  beforeEach(() => {
    router = new AgentRouter();
  });

  describe('intent override (highest priority)', () => {
    it('COMPLAINT + any businessType → SupportAgent', () => {
      const result = router.route({
        businessType: 'recovery',
        currentPhase: 'DEBT_IDENTIFICATION',
        lastIntent: 'COMPLAINT',
      });
      expect(result.agent.id).toBe('support');
      expect(result.reason).toBe('intent_override:COMPLAINT');
    });

    it('COMPLAINT + ecommerce → SupportAgent', () => {
      const result = router.route({
        businessType: 'ecommerce',
        currentPhase: 'CHECKOUT',
        lastIntent: 'COMPLAINT',
      });
      expect(result.agent.id).toBe('support');
    });

    it('PURCHASE intent → no override (falls to businessType)', () => {
      const result = router.route({
        businessType: 'recovery',
        currentPhase: null,
        lastIntent: 'PURCHASE',
      });
      expect(result.agent.id).toBe('recovery');
    });
  });

  describe('phase override', () => {
    it('SUPPORT phase + recovery → SupportAgent', () => {
      const result = router.route({
        businessType: 'recovery',
        currentPhase: 'SUPPORT',
        lastIntent: null,
      });
      expect(result.agent.id).toBe('support');
      expect(result.reason).toBe('phase_override:SUPPORT');
    });

    it('COMPLAINT phase → SupportAgent', () => {
      const result = router.route({
        businessType: 'ecommerce',
        currentPhase: 'COMPLAINT',
        lastIntent: null,
      });
      expect(result.agent.id).toBe('support');
      expect(result.reason).toBe('phase_override:COMPLAINT');
    });
  });

  describe('businessType routing', () => {
    it('recovery → RecoveryAgent', () => {
      const result = router.route({
        businessType: 'recovery',
        currentPhase: 'DEBT_IDENTIFICATION',
        lastIntent: null,
      });
      expect(result.agent.id).toBe('recovery');
      expect(result.reason).toBe('business_type:recovery');
    });

    it('clinic → SchedulingAgent', () => {
      const result = router.route({
        businessType: 'clinic',
        currentPhase: 'GREETING',
        lastIntent: null,
      });
      expect(result.agent.id).toBe('scheduling');
      expect(result.reason).toBe('business_type:clinic');
    });

    it('restaurant → CommerceAgent', () => {
      const result = router.route({
        businessType: 'restaurant',
        currentPhase: 'ORDER_TAKING',
        lastIntent: null,
      });
      expect(result.agent.id).toBe('commerce');
      expect(result.reason).toBe('business_type:restaurant');
    });

    it('ecommerce → SalesAgent (default)', () => {
      const result = router.route({
        businessType: 'ecommerce',
        currentPhase: 'GREETING',
        lastIntent: null,
      });
      expect(result.agent.id).toBe('sales');
      expect(result.reason).toBe('default:sales');
    });

    it('generic → SalesAgent', () => {
      const result = router.route({
        businessType: 'generic',
        currentPhase: null,
        lastIntent: null,
      });
      expect(result.agent.id).toBe('sales');
      expect(result.reason).toBe('default:sales');
    });

    it('unknown → SalesAgent (fallback)', () => {
      const result = router.route({
        businessType: 'unknown' as any,
        currentPhase: null,
        lastIntent: null,
      });
      expect(result.agent.id).toBe('sales');
      expect(result.reason).toBe('default:sales');
    });
  });

  describe('tenant override (highest of all)', () => {
    it('tenantOverride forces agent regardless of other inputs', () => {
      const result = router.route({
        businessType: 'ecommerce',
        currentPhase: 'GREETING',
        lastIntent: 'COMPLAINT',
        tenantOverride: 'commerce',
      });
      expect(result.agent.id).toBe('commerce');
      expect(result.reason).toBe('tenant_override:commerce');
    });

    it('invalid tenantOverride falls through to normal routing', () => {
      const result = router.route({
        businessType: 'recovery',
        currentPhase: null,
        lastIntent: null,
        tenantOverride: 'nonexistent',
      });
      expect(result.agent.id).toBe('recovery');
    });
  });

  describe('routing reason', () => {
    it('always returns a reason string', () => {
      const result = router.route({
        businessType: 'generic',
        currentPhase: null,
        lastIntent: null,
      });
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });
});
