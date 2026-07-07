import {
  BaseAgentResponseSchema,
  RecoveryResponseSchema,
  SchedulingResponseSchema,
  CommerceResponseSchema,
} from '../schemas';

describe('Agent Response Schemas', () => {
  const validBase = {
    reply: 'Olá, como posso ajudar?',
    confidence: 0.92,
    intent: 'GREETING',
    sentiment: 'NEUTRAL',
  };

  describe('BaseAgentResponseSchema', () => {
    it('accepts valid base response', () => {
      const result = BaseAgentResponseSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it('accepts response with phase and phaseConfidence', () => {
      const result = BaseAgentResponseSchema.safeParse({
        ...validBase,
        phase: 'QUALIFICATION',
        phaseConfidence: 0.85,
      });
      expect(result.success).toBe(true);
    });

    it('phase and phaseConfidence are optional', () => {
      const result = BaseAgentResponseSchema.safeParse(validBase);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phase).toBeUndefined();
        expect(result.data.phaseConfidence).toBeUndefined();
      }
    });

    it('rejects missing reply', () => {
      const { reply, ...noReply } = validBase;
      expect(BaseAgentResponseSchema.safeParse(noReply).success).toBe(false);
    });

    it('rejects empty reply', () => {
      expect(
        BaseAgentResponseSchema.safeParse({ ...validBase, reply: '' }).success,
      ).toBe(false);
    });

    it('rejects invalid sentiment', () => {
      expect(
        BaseAgentResponseSchema.safeParse({
          ...validBase,
          sentiment: 'ANGRY',
        }).success,
      ).toBe(false);
    });

    it('rejects invalid intent', () => {
      expect(
        BaseAgentResponseSchema.safeParse({
          ...validBase,
          intent: 'UNKNOWN',
        }).success,
      ).toBe(false);
    });

    it('rejects confidence out of range', () => {
      expect(
        BaseAgentResponseSchema.safeParse({
          ...validBase,
          confidence: 1.5,
        }).success,
      ).toBe(false);
      expect(
        BaseAgentResponseSchema.safeParse({
          ...validBase,
          confidence: -0.1,
        }).success,
      ).toBe(false);
    });
  });

  describe('RecoveryResponseSchema', () => {
    it('accepts base fields (backward compat)', () => {
      expect(RecoveryResponseSchema.safeParse(validBase).success).toBe(true);
    });

    it('accepts negotiationStatus', () => {
      const result = RecoveryResponseSchema.safeParse({
        ...validBase,
        negotiationStatus: 'AGREED',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.negotiationStatus).toBe('AGREED');
      }
    });

    it('accepts debtAcknowledged', () => {
      const result = RecoveryResponseSchema.safeParse({
        ...validBase,
        debtAcknowledged: true,
      });
      expect(result.success).toBe(true);
    });

    it('accepts proposedPaymentPlan', () => {
      const result = RecoveryResponseSchema.safeParse({
        ...validBase,
        proposedPaymentPlan: '3x de R$150',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid negotiationStatus', () => {
      expect(
        RecoveryResponseSchema.safeParse({
          ...validBase,
          negotiationStatus: 'INVALID',
        }).success,
      ).toBe(false);
    });

    it('rejects invalid base fields', () => {
      expect(
        RecoveryResponseSchema.safeParse({
          ...validBase,
          intent: 'INVALID',
          negotiationStatus: 'OPEN',
        }).success,
      ).toBe(false);
    });
  });

  describe('SchedulingResponseSchema', () => {
    it('accepts base fields', () => {
      expect(SchedulingResponseSchema.safeParse(validBase).success).toBe(true);
    });

    it('accepts suggestedDate', () => {
      const result = SchedulingResponseSchema.safeParse({
        ...validBase,
        suggestedDate: '2026-07-15',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.suggestedDate).toBe('2026-07-15');
      }
    });

    it('accepts suggestedProfessional', () => {
      const result = SchedulingResponseSchema.safeParse({
        ...validBase,
        suggestedProfessional: 'Dr. Silva',
      });
      expect(result.success).toBe(true);
    });

    it('accepts appointmentConfirmed', () => {
      const result = SchedulingResponseSchema.safeParse({
        ...validBase,
        appointmentConfirmed: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('CommerceResponseSchema', () => {
    it('accepts base fields', () => {
      expect(CommerceResponseSchema.safeParse(validBase).success).toBe(true);
    });

    it('accepts orderItems array', () => {
      const result = CommerceResponseSchema.safeParse({
        ...validBase,
        orderItems: ['Pizza Margherita', 'Coca-Cola 2L'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderItems).toHaveLength(2);
      }
    });

    it('accepts orderTotal', () => {
      const result = CommerceResponseSchema.safeParse({
        ...validBase,
        orderTotal: 55.9,
      });
      expect(result.success).toBe(true);
    });

    it('accepts deliveryEstimate', () => {
      const result = CommerceResponseSchema.safeParse({
        ...validBase,
        deliveryEstimate: '30-45 minutos',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid orderItems (not array of strings)', () => {
      expect(
        CommerceResponseSchema.safeParse({
          ...validBase,
          orderItems: [123, 456],
        }).success,
      ).toBe(false);
    });
  });
});
