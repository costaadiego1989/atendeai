import { RecoveryMenuBuilder } from '../../application/services/welcome-menu/builders/RecoveryMenuBuilder';
import { MenuBuilderInput } from '../../application/services/welcome-menu/builders/IMenuBuilder';
import { MenuConditions } from '../../application/services/welcome-menu/MenuConditionEvaluator';

describe('RecoveryMenuBuilder', () => {
  let builder: RecoveryMenuBuilder;

  beforeEach(() => {
    builder = new RecoveryMenuBuilder();
  });

  describe('supports', () => {
    it('should support RECOVERY', () => {
      expect(builder.supports('RECOVERY')).toBe(true);
    });

    it('should not support other categories', () => {
      expect(builder.supports('RETAIL')).toBe(false);
      expect(builder.supports('HEALTH')).toBe(false);
      expect(builder.supports('HOME_SERV')).toBe(false);
      expect(builder.supports('DEFAULT')).toBe(false);
    });
  });

  describe('build', () => {
    const baseConditions: MenuConditions = {
      hasOperatingHours: false,
      hasPromotions: false,
      hasCatalogFiles: false,
      hasCatalogUrl: false,
      hasServices: false,
      hasSchedulingCategories: false,
      hasCommerceCatalog: false,
      hasRecoveryCases: true,
    };

    it('should include all core recovery options', () => {
      const input: MenuBuilderInput = {
        companyName: 'Cobranças XYZ',
        category: 'RECOVERY',
        conditions: baseConditions,
      };

      const result = builder.build(input);

      expect(result).toContain('Consultar pendências');
      expect(result).toContain('Segunda via de boleto');
      expect(result).toContain('Negociar pagamento');
      expect(result).toContain('Informar pagamento realizado');
      expect(result).toContain('Agendar data de pagamento');
      expect(result).toContain('Falar com atendente');
    });

    it('should use emoji numbers in sequence', () => {
      const input: MenuBuilderInput = {
        companyName: 'Cobranças XYZ',
        category: 'RECOVERY',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      expect(result).toContain('1️⃣');
      expect(result).toContain('2️⃣');
      expect(result).toContain('3️⃣');
      expect(result).toContain('4️⃣');
      expect(result).toContain('5️⃣');
      expect(result).toContain('6️⃣');
    });

    it('should end with "Falar com atendente"', () => {
      const input: MenuBuilderInput = {
        companyName: 'Cobranças XYZ',
        category: 'RECOVERY',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      const lines = result.split('\n').filter((l) => l.trim());
      const lastLine = lines[lines.length - 1];
      expect(lastLine).toContain('Falar com atendente');
    });
  });
});
