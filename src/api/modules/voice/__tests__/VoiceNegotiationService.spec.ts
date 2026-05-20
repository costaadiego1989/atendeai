import { VoiceNegotiationService } from '../application/services/VoiceNegotiationService';
import { VoiceAgentConfig } from '../domain/value-objects/NegotiationRules';

describe('VoiceNegotiationService', () => {
  let service: VoiceNegotiationService;

  const baseConfig: VoiceAgentConfig = {
    id: 'config-1',
    tenantId: 'tenant-1',
    enabled: true,
    voiceId: 'voice-1',
    language: 'pt-BR',
    maxDiscountPercent: 15,
    maxInstallments: 6,
    minInstallmentValue: 50,
    callWindowStart: '09:00',
    callWindowEnd: '18:00',
    blockedDays: [],
    greeting: 'Olá {nome}, temos um débito de {valor} referente a {servico}.',
    transferPhone: '+5511999999999',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseContext = {
    debtorName: 'João Silva',
    amountDue: 500,
    dueDate: '2026-01-01',
    daysOverdue: 30,
    chargeTitle: 'Mensalidade Janeiro',
    previousAttempts: 2,
  };

  beforeEach(() => {
    service = new VoiceNegotiationService();
  });

  describe('buildNegotiationPrompt', () => {
    it('should build prompt with offers', () => {
      const result = service.buildNegotiationPrompt(baseConfig, baseContext);

      expect(result.systemPrompt).toContain('João Silva');
      expect(result.systemPrompt).toContain('R$ 500.00');
      expect(result.systemPrompt).toContain('Mensalidade Janeiro');
      expect(result.systemPrompt).toContain('15%');
      expect(result.offers.length).toBeGreaterThanOrEqual(2);
    });

    it('should include discount offer when maxDiscountPercent > 0', () => {
      const result = service.buildNegotiationPrompt(baseConfig, baseContext);

      const discountOffer = result.offers.find((o) => o.type === 'DISCOUNT');
      expect(discountOffer).toBeDefined();
      expect(discountOffer!.discountPercent).toBe(15);
      expect(discountOffer!.totalValue).toBe(425); // 500 * 0.85
    });

    it('should include installment offer when applicable', () => {
      const result = service.buildNegotiationPrompt(baseConfig, baseContext);

      const installmentOffer = result.offers.find((o) => o.type === 'INSTALLMENT');
      expect(installmentOffer).toBeDefined();
      expect(installmentOffer!.installments).toBe(6);
      expect(installmentOffer!.installmentValue).toBeCloseTo(83.33, 1);
    });

    it('should not include installment offer when installment value is below minimum', () => {
      const lowAmountContext = { ...baseContext, amountDue: 100 };
      // 100 / 6 = 16.67 which is below minInstallmentValue of 50
      const result = service.buildNegotiationPrompt(baseConfig, lowAmountContext);

      const installmentOffer = result.offers.find((o) => o.type === 'INSTALLMENT');
      expect(installmentOffer).toBeUndefined();
    });

    it('should use custom greeting with variable interpolation', () => {
      const result = service.buildNegotiationPrompt(baseConfig, baseContext);

      expect(result.greeting).toContain('João Silva');
      expect(result.greeting).toContain('R$ 500.00');
      expect(result.greeting).toContain('Mensalidade Janeiro');
    });

    it('should use default greeting when config.greeting is null', () => {
      const noGreetingConfig = { ...baseConfig, greeting: null };
      const result = service.buildNegotiationPrompt(noGreetingConfig, baseContext);

      expect(result.greeting).toContain('João Silva');
      expect(result.greeting).toContain('R$ 500.00');
      expect(result.greeting).toContain('equipe de cobrança');
    });
  });

  describe('evaluateCounterOffer', () => {
    it('should accept offer within rules', () => {
      const result = service.evaluateCounterOffer(10, 3, 500, baseConfig);

      expect(result.acceptable).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject discount above maximum', () => {
      const result = service.evaluateCounterOffer(20, 1, 500, baseConfig);

      expect(result.acceptable).toBe(false);
      expect(result.reason).toContain('15%');
      expect(result.bestOffer).toBeDefined();
      expect(result.bestOffer!.discountPercent).toBe(15);
    });

    it('should reject installments above maximum', () => {
      const result = service.evaluateCounterOffer(0, 12, 500, baseConfig);

      expect(result.acceptable).toBe(false);
      expect(result.reason).toContain('6 parcelas');
      expect(result.bestOffer).toBeDefined();
      expect(result.bestOffer!.installments).toBe(6);
    });

    it('should reject when installment value is below minimum', () => {
      // 500 * (1 - 10/100) / 10 = 45, below minInstallmentValue of 50
      const result = service.evaluateCounterOffer(10, 10, 500, baseConfig);

      // 10 installments > max 6, so it fails on installments first
      expect(result.acceptable).toBe(false);
    });

    it('should reject when calculated installment is below minimum', () => {
      // Config with higher max installments to test min value check
      const highInstallConfig = { ...baseConfig, maxInstallments: 20 };
      // 200 * (1 - 5/100) / 10 = 19, below 50
      const result = service.evaluateCounterOffer(5, 10, 200, highInstallConfig);

      expect(result.acceptable).toBe(false);
      expect(result.reason).toContain('R$ 50.00');
    });
  });
});
