import { isWithinCallWindow, buildNegotiationRules, VoiceAgentConfig } from '../domain/value-objects/NegotiationRules';

describe('NegotiationRules', () => {
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
    blockedDays: ['sunday', 'saturday'],
    greeting: 'Olá!',
    transferPhone: '+5511999999999',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('isWithinCallWindow', () => {
    it('should return true when within call window on allowed day', () => {
      // Mock a Wednesday at 10:00
      const mockDate = new Date('2026-01-07T10:00:00'); // Wednesday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const result = isWithinCallWindow(baseConfig);
      expect(result).toBe(true);

      jest.restoreAllMocks();
    });

    it('should return false when outside call window (too early)', () => {
      // Mock a Wednesday at 07:00
      const mockDate = new Date('2026-01-07T07:00:00'); // Wednesday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const result = isWithinCallWindow(baseConfig);
      expect(result).toBe(false);

      jest.restoreAllMocks();
    });

    it('should return false when outside call window (too late)', () => {
      // Mock a Wednesday at 19:00
      const mockDate = new Date('2026-01-07T19:00:00'); // Wednesday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const result = isWithinCallWindow(baseConfig);
      expect(result).toBe(false);

      jest.restoreAllMocks();
    });

    it('should return false on blocked day', () => {
      // Mock a Sunday at 10:00
      const mockDate = new Date('2026-01-04T10:00:00'); // Sunday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const result = isWithinCallWindow(baseConfig);
      expect(result).toBe(false);

      jest.restoreAllMocks();
    });

    it('should return true at exact start time', () => {
      // Mock a Monday at 09:00
      const mockDate = new Date('2026-01-05T09:00:00'); // Monday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const result = isWithinCallWindow(baseConfig);
      expect(result).toBe(true);

      jest.restoreAllMocks();
    });
  });

  describe('buildNegotiationRules', () => {
    it('should build rules from config', () => {
      const rules = buildNegotiationRules(baseConfig);

      expect(rules).toEqual({
        maxDiscountPercent: 15,
        maxInstallments: 6,
        minInstallmentValue: 50,
        allowedPaymentMethods: ['PIX', 'BOLETO', 'CREDIT_CARD'],
      });
    });

    it('should use config values directly', () => {
      const customConfig = { ...baseConfig, maxDiscountPercent: 25, maxInstallments: 12, minInstallmentValue: 30 };
      const rules = buildNegotiationRules(customConfig);

      expect(rules.maxDiscountPercent).toBe(25);
      expect(rules.maxInstallments).toBe(12);
      expect(rules.minInstallmentValue).toBe(30);
    });
  });
});
