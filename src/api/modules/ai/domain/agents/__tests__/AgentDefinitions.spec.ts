import {
  SalesAgentDefinition,
  RecoveryAgentDefinition,
  SchedulingAgentDefinition,
  CommerceAgentDefinition,
  SupportAgentDefinition,
} from '../definitions';

describe('Agent Definitions', () => {
  describe('SalesAgentDefinition', () => {
    it('has correct id', () => {
      expect(SalesAgentDefinition.id).toBe('sales');
    });

    it('serves ecommerce, generic, law', () => {
      expect(SalesAgentDefinition.businessTypes).toContain('ecommerce');
      expect(SalesAgentDefinition.businessTypes).toContain('generic');
      expect(SalesAgentDefinition.businessTypes).toContain('law');
    });

    it('has payment and automation tools', () => {
      const toolNames = SalesAgentDefinition.tools.map((t) => t.name);
      expect(toolNames).toContain('generate_payment_link');
      expect(toolNames).toContain('trigger_automation');
    });

    it('uses BaseAgentResponseSchema', () => {
      const result = SalesAgentDefinition.responseSchema.safeParse({
        reply: 'Olá',
        confidence: 0.9,
        intent: 'GREETING',
        sentiment: 'NEUTRAL',
      });
      expect(result.success).toBe(true);
    });

    it('has ecommerce phases', () => {
      expect(SalesAgentDefinition.phases.phases).toContain('CHECKOUT');
      expect(SalesAgentDefinition.phases.phases).toContain('PRODUCT_DISCOVERY');
    });

    it('defaultPhase is GREETING', () => {
      expect(SalesAgentDefinition.defaultPhase).toBe('GREETING');
    });

    it('has non-empty systemPromptTemplate', () => {
      expect(SalesAgentDefinition.systemPromptTemplate.length).toBeGreaterThan(100);
      expect(SalesAgentDefinition.systemPromptTemplate).toContain('{{tenantName}}');
      expect(SalesAgentDefinition.systemPromptTemplate).toContain('{{currentPhase}}');
    });
  });

  describe('RecoveryAgentDefinition', () => {
    it('has correct id', () => {
      expect(RecoveryAgentDefinition.id).toBe('recovery');
    });

    it('serves recovery businessType', () => {
      expect(RecoveryAgentDefinition.businessTypes).toEqual(['recovery']);
    });

    it('has payment link tool', () => {
      const toolNames = RecoveryAgentDefinition.tools.map((t) => t.name);
      expect(toolNames).toContain('generate_payment_link');
    });

    it('uses RecoveryResponseSchema', () => {
      const result = RecoveryAgentDefinition.responseSchema.safeParse({
        reply: 'Entendo',
        confidence: 0.8,
        intent: 'GENERAL',
        sentiment: 'NEUTRAL',
        negotiationStatus: 'OPEN',
      });
      expect(result.success).toBe(true);
    });

    it('has recovery phases', () => {
      expect(RecoveryAgentDefinition.phases.phases).toContain('DEBT_IDENTIFICATION');
      expect(RecoveryAgentDefinition.phases.phases).toContain('NEGOTIATION');
      expect(RecoveryAgentDefinition.phases.phases).toContain('PROMISE_TO_PAY');
    });
  });

  describe('SchedulingAgentDefinition', () => {
    it('has correct id', () => {
      expect(SchedulingAgentDefinition.id).toBe('scheduling');
    });

    it('serves clinic and salon', () => {
      expect(SchedulingAgentDefinition.businessTypes).toEqual(['clinic', 'salon']);
    });

    it('has schedule_slot tool', () => {
      const toolNames = SchedulingAgentDefinition.tools.map((t) => t.name);
      expect(toolNames).toContain('schedule_slot');
    });

    it('uses SchedulingResponseSchema', () => {
      const result = SchedulingAgentDefinition.responseSchema.safeParse({
        reply: 'Temos horário',
        confidence: 0.9,
        intent: 'GENERAL',
        sentiment: 'POSITIVE',
        suggestedDate: '2026-07-15',
      });
      expect(result.success).toBe(true);
    });

    it('has scheduling phases', () => {
      expect(SchedulingAgentDefinition.phases.phases).toContain('SCHEDULING');
      expect(SchedulingAgentDefinition.phases.phases).toContain('CONFIRMATION');
    });
  });

  describe('CommerceAgentDefinition', () => {
    it('has correct id', () => {
      expect(CommerceAgentDefinition.id).toBe('commerce');
    });

    it('serves restaurant', () => {
      expect(CommerceAgentDefinition.businessTypes).toEqual(['restaurant']);
    });

    it('has repeat_last_order and payment tools', () => {
      const toolNames = CommerceAgentDefinition.tools.map((t) => t.name);
      expect(toolNames).toContain('repeat_last_order');
      expect(toolNames).toContain('generate_payment_link');
    });

    it('uses CommerceResponseSchema', () => {
      const result = CommerceAgentDefinition.responseSchema.safeParse({
        reply: 'Seu pedido',
        confidence: 0.85,
        intent: 'PURCHASE',
        sentiment: 'POSITIVE',
        orderItems: ['Pizza'],
        orderTotal: 45.0,
      });
      expect(result.success).toBe(true);
    });

    it('has restaurant phases', () => {
      expect(CommerceAgentDefinition.phases.phases).toContain('ORDER_TAKING');
      expect(CommerceAgentDefinition.phases.phases).toContain('CUSTOMIZATION');
      expect(CommerceAgentDefinition.phases.phases).toContain('DELIVERY_TRACKING');
    });
  });

  describe('SupportAgentDefinition', () => {
    it('has correct id', () => {
      expect(SupportAgentDefinition.id).toBe('support');
    });

    it('has empty businessTypes (intent-triggered)', () => {
      expect(SupportAgentDefinition.businessTypes).toEqual([]);
    });

    it('triggers on COMPLAINT intent', () => {
      expect(SupportAgentDefinition.intents).toContain('COMPLAINT');
    });

    it('has only trigger_automation tool', () => {
      expect(SupportAgentDefinition.tools).toHaveLength(1);
      expect(SupportAgentDefinition.tools[0].name).toBe('trigger_automation');
    });

    it('has support-only phases', () => {
      expect(SupportAgentDefinition.phases.phases).toContain('SUPPORT');
      expect(SupportAgentDefinition.phases.phases).toContain('COMPLAINT');
      expect(SupportAgentDefinition.phases.phases).not.toContain('CHECKOUT');
    });
  });
});
