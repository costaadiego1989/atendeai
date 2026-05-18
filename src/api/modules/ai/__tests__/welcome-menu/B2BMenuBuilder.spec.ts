import { B2BMenuBuilder } from '../../application/services/welcome-menu/builders/B2BMenuBuilder';
import { MenuBuilderInput } from '../../application/services/welcome-menu/builders/IMenuBuilder';
import { MenuConditions } from '../../application/services/welcome-menu/MenuConditionEvaluator';

describe('B2BMenuBuilder', () => {
  let builder: B2BMenuBuilder;

  beforeEach(() => {
    builder = new B2BMenuBuilder();
  });

  describe('supports', () => {
    it('should support B2B', () => {
      expect(builder.supports('B2B')).toBe(true);
    });

    it('should not support other categories', () => {
      expect(builder.supports('RETAIL')).toBe(false);
      expect(builder.supports('HOME_SERV')).toBe(false);
      expect(builder.supports('EDUCATION')).toBe(false);
      expect(builder.supports('DEFAULT')).toBe(false);
    });
  });

  describe('build', () => {
    const baseConditions: MenuConditions = {
      hasOperatingHours: false,
      hasPromotions: false,
      hasCatalogFiles: false,
      hasCatalogUrl: false,
      hasServices: true,
      hasSchedulingCategories: false,
      hasCommerceCatalog: false,
      hasRecoveryCases: false,
    };

    it('should include core options', () => {
      const input: MenuBuilderInput = {
        companyName: 'Tech Solutions',
        category: 'B2B',
        conditions: baseConditions,
      };

      const result = builder.build(input);

      expect(result).toContain('Nossas soluções');
      expect(result).toContain('Solicitar proposta comercial');
      expect(result).toContain('Acompanhar proposta');
      expect(result).toContain('Falar com consultor');
    });

    it('should include cases when hasCatalogFiles', () => {
      const input: MenuBuilderInput = {
        companyName: 'Tech Solutions',
        category: 'B2B',
        conditions: { ...baseConditions, hasCatalogFiles: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Cases e resultados');
    });

    it('should not include cases when no catalog files', () => {
      const input: MenuBuilderInput = {
        companyName: 'Tech Solutions',
        category: 'B2B',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      expect(result).not.toContain('Cases e resultados');
    });

    it('should include agendar reunião when hasSchedulingCategories', () => {
      const input: MenuBuilderInput = {
        companyName: 'Tech Solutions',
        category: 'B2B',
        conditions: { ...baseConditions, hasSchedulingCategories: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Agendar reunião');
    });

    it('should not include agendar reunião when no scheduling', () => {
      const input: MenuBuilderInput = {
        companyName: 'Tech Solutions',
        category: 'B2B',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      expect(result).not.toContain('Agendar reunião');
    });

    it('should end with "Falar com consultor"', () => {
      const input: MenuBuilderInput = {
        companyName: 'Tech Solutions',
        category: 'B2B',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      const lines = result.split('\n').filter((l) => l.trim());
      const lastLine = lines[lines.length - 1];
      expect(lastLine).toContain('Falar com consultor');
    });
  });
});
