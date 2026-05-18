import { DefaultMenuBuilder } from '../../application/services/welcome-menu/builders/DefaultMenuBuilder';
import { MenuBuilderInput } from '../../application/services/welcome-menu/builders/IMenuBuilder';
import { MenuConditions } from '../../application/services/welcome-menu/MenuConditionEvaluator';

describe('DefaultMenuBuilder', () => {
  let builder: DefaultMenuBuilder;

  beforeEach(() => {
    builder = new DefaultMenuBuilder();
  });

  describe('supports', () => {
    it('should support DEFAULT', () => {
      expect(builder.supports('DEFAULT')).toBe(true);
    });

    it('should not support other categories', () => {
      expect(builder.supports('RETAIL')).toBe(false);
      expect(builder.supports('HEALTH')).toBe(false);
      expect(builder.supports('HOME_SERV')).toBe(false);
      expect(builder.supports('B2B')).toBe(false);
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
      hasRecoveryCases: false,
    };

    it('should always include "Falar com atendente"', () => {
      const input: MenuBuilderInput = {
        companyName: 'Empresa X',
        category: 'DEFAULT',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      expect(result).toContain('Falar com atendente');
    });

    it('should include services when hasServices', () => {
      const input: MenuBuilderInput = {
        companyName: 'Empresa X',
        category: 'DEFAULT',
        conditions: { ...baseConditions, hasServices: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Conhecer nossos serviços');
    });

    it('should not include services when no services', () => {
      const input: MenuBuilderInput = {
        companyName: 'Empresa X',
        category: 'DEFAULT',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      expect(result).not.toContain('Conhecer nossos serviços');
    });

    it('should include scheduling when hasSchedulingCategories', () => {
      const input: MenuBuilderInput = {
        companyName: 'Empresa X',
        category: 'DEFAULT',
        conditions: { ...baseConditions, hasSchedulingCategories: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Agendar atendimento');
    });

    it('should include commerce when hasCommerceCatalog', () => {
      const input: MenuBuilderInput = {
        companyName: 'Empresa X',
        category: 'DEFAULT',
        conditions: { ...baseConditions, hasCommerceCatalog: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Fazer um pedido');
    });

    it('should include operating hours when hasOperatingHours', () => {
      const input: MenuBuilderInput = {
        companyName: 'Empresa X',
        category: 'DEFAULT',
        conditions: { ...baseConditions, hasOperatingHours: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Horários');
    });

    it('should include promotions when hasPromotions', () => {
      const input: MenuBuilderInput = {
        companyName: 'Empresa X',
        category: 'DEFAULT',
        conditions: { ...baseConditions, hasPromotions: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Promoções');
    });

    it('should build full menu with all conditions true', () => {
      const input: MenuBuilderInput = {
        companyName: 'Empresa X',
        category: 'DEFAULT',
        conditions: {
          hasOperatingHours: true,
          hasPromotions: true,
          hasCatalogFiles: false,
          hasCatalogUrl: false,
          hasServices: true,
          hasSchedulingCategories: true,
          hasCommerceCatalog: true,
          hasRecoveryCases: false,
        },
      };

      const result = builder.build(input);

      expect(result).toContain('Conhecer nossos serviços');
      expect(result).toContain('Agendar atendimento');
      expect(result).toContain('Fazer um pedido');
      expect(result).toContain('Horários');
      expect(result).toContain('Promoções');
      expect(result).toContain('Falar com atendente');
    });

    it('should only show "Falar com atendente" when no conditions are met', () => {
      const input: MenuBuilderInput = {
        companyName: 'Empresa X',
        category: 'DEFAULT',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      const lines = result.split('\n').filter((l) => l.trim());
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('Falar com atendente');
    });
  });
});
