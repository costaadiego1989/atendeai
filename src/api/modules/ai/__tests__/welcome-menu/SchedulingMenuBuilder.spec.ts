import { SchedulingMenuBuilder } from '../../application/services/welcome-menu/builders/SchedulingMenuBuilder';
import { MenuBuilderInput } from '../../application/services/welcome-menu/builders/IMenuBuilder';
import { MenuConditions } from '../../application/services/welcome-menu/MenuConditionEvaluator';

describe('SchedulingMenuBuilder', () => {
  let builder: SchedulingMenuBuilder;

  beforeEach(() => {
    builder = new SchedulingMenuBuilder();
  });

  describe('supports', () => {
    it('should support HEALTH', () => {
      expect(builder.supports('HEALTH')).toBe(true);
    });

    it('should support BEAUTY', () => {
      expect(builder.supports('BEAUTY')).toBe(true);
    });

    it('should not support other categories', () => {
      expect(builder.supports('RETAIL')).toBe(false);
      expect(builder.supports('FOOD')).toBe(false);
      expect(builder.supports('RECOVERY')).toBe(false);
      expect(builder.supports('HOME_SERV')).toBe(false);
      expect(builder.supports('DEFAULT')).toBe(false);
    });
  });

  describe('build — HEALTH', () => {
    const baseConditions: MenuConditions = {
      hasOperatingHours: false,
      hasPromotions: false,
      hasCatalogFiles: false,
      hasCatalogUrl: false,
      hasServices: false,
      hasSchedulingCategories: true,
      hasCommerceCatalog: false,
      hasRecoveryCases: false,
    };

    it('should include core options for HEALTH', () => {
      const input: MenuBuilderInput = {
        companyName: 'Clínica Saúde',
        category: 'HEALTH',
        conditions: baseConditions,
      };

      const result = builder.build(input);

      expect(result).toContain('Agendar consulta');
      expect(result).toContain('Remarcar ou cancelar');
      expect(result).toContain('Especialidades e serviços');
      expect(result).toContain('Falar com atendente');
    });

    it('should include catalog files option when available (procedimentos)', () => {
      const input: MenuBuilderInput = {
        companyName: 'Clínica Saúde',
        category: 'HEALTH',
        conditions: { ...baseConditions, hasCatalogFiles: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Informações sobre procedimentos');
    });

    it('should include operating hours when available', () => {
      const input: MenuBuilderInput = {
        companyName: 'Clínica Saúde',
        category: 'HEALTH',
        conditions: { ...baseConditions, hasOperatingHours: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Horários de atendimento');
    });

    it('should not include operating hours when not available', () => {
      const input: MenuBuilderInput = {
        companyName: 'Clínica Saúde',
        category: 'HEALTH',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      expect(result).not.toContain('Horários de atendimento');
    });

    it('should include values option when scheduling categories exist', () => {
      const input: MenuBuilderInput = {
        companyName: 'Clínica Saúde',
        category: 'HEALTH',
        conditions: { ...baseConditions, hasSchedulingCategories: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Valores e formas de pagamento');
    });
  });

  describe('build — BEAUTY', () => {
    const baseConditions: MenuConditions = {
      hasOperatingHours: false,
      hasPromotions: false,
      hasCatalogFiles: false,
      hasCatalogUrl: false,
      hasServices: false,
      hasSchedulingCategories: true,
      hasCommerceCatalog: false,
      hasRecoveryCases: false,
    };

    it('should include core options for BEAUTY', () => {
      const input: MenuBuilderInput = {
        companyName: 'Barbearia Style',
        category: 'BEAUTY',
        conditions: baseConditions,
      };

      const result = builder.build(input);

      expect(result).toContain('Agendar horário');
      expect(result).toContain('Remarcar ou cancelar');
      expect(result).toContain('Serviços e preços');
      expect(result).toContain('Nossos profissionais');
      expect(result).toContain('Falar com atendente');
    });

    it('should include promotions when available', () => {
      const input: MenuBuilderInput = {
        companyName: 'Barbearia Style',
        category: 'BEAUTY',
        conditions: { ...baseConditions, hasPromotions: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Promoções');
    });

    it('should include operating hours when available', () => {
      const input: MenuBuilderInput = {
        companyName: 'Barbearia Style',
        category: 'BEAUTY',
        conditions: { ...baseConditions, hasOperatingHours: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Horários de funcionamento');
    });

    it('should include packages for GYM businessType', () => {
      const input: MenuBuilderInput = {
        companyName: 'Academia Fit',
        category: 'BEAUTY',
        conditions: baseConditions,
        businessType: 'GYM',
      };

      const result = builder.build(input);
      expect(result).toContain('Pacotes e planos');
    });

    it('should not include packages for regular BEAUTY businessType', () => {
      const input: MenuBuilderInput = {
        companyName: 'Salão Beleza',
        category: 'BEAUTY',
        conditions: baseConditions,
        businessType: 'BEAUTY',
      };

      const result = builder.build(input);
      expect(result).not.toContain('Pacotes e planos');
    });
  });

  describe('menu numbering', () => {
    it('should use emoji numbers in sequence', () => {
      const input: MenuBuilderInput = {
        companyName: 'Clínica',
        category: 'HEALTH',
        conditions: {
          hasOperatingHours: true,
          hasPromotions: false,
          hasCatalogFiles: true,
          hasCatalogUrl: false,
          hasServices: false,
          hasSchedulingCategories: true,
          hasCommerceCatalog: false,
          hasRecoveryCases: false,
        },
      };

      const result = builder.build(input);
      expect(result).toContain('1️⃣');
      expect(result).toContain('2️⃣');
      expect(result).toContain('3️⃣');
    });
  });
});
