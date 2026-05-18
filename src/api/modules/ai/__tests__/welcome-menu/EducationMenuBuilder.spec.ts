import { EducationMenuBuilder } from '../../application/services/welcome-menu/builders/EducationMenuBuilder';
import { MenuBuilderInput } from '../../application/services/welcome-menu/builders/IMenuBuilder';
import { MenuConditions } from '../../application/services/welcome-menu/MenuConditionEvaluator';

describe('EducationMenuBuilder', () => {
  let builder: EducationMenuBuilder;

  beforeEach(() => {
    builder = new EducationMenuBuilder();
  });

  describe('supports', () => {
    it('should support EDUCATION', () => {
      expect(builder.supports('EDUCATION')).toBe(true);
    });

    it('should not support other categories', () => {
      expect(builder.supports('RETAIL')).toBe(false);
      expect(builder.supports('HOME_SERV')).toBe(false);
      expect(builder.supports('B2B')).toBe(false);
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
      hasRecoveryCases: false,
    };

    it('should include core options', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escola ABC',
        category: 'EDUCATION',
        conditions: baseConditions,
      };

      const result = builder.build(input);

      expect(result).toContain('Cursos disponíveis');
      expect(result).toContain('Matrícula e pacotes');
      expect(result).toContain('Acompanhar matrícula');
      expect(result).toContain('Falar com atendente');
    });

    it('should include agendar aula experimental when hasSchedulingCategories', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escola ABC',
        category: 'EDUCATION',
        conditions: { ...baseConditions, hasSchedulingCategories: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Agendar aula experimental');
    });

    it('should not include agendar aula when no scheduling categories', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escola ABC',
        category: 'EDUCATION',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      expect(result).not.toContain('Agendar aula experimental');
    });

    it('should include horários when hasOperatingHours', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escola ABC',
        category: 'EDUCATION',
        conditions: { ...baseConditions, hasOperatingHours: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Horários das turmas');
    });

    it('should include material didático when hasCatalogFiles', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escola ABC',
        category: 'EDUCATION',
        conditions: { ...baseConditions, hasCatalogFiles: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Material didático');
    });

    it('should include promoções e bolsas when hasPromotions', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escola ABC',
        category: 'EDUCATION',
        conditions: { ...baseConditions, hasPromotions: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Promoções e bolsas');
    });

    it('should end with "Falar com atendente"', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escola ABC',
        category: 'EDUCATION',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      const lines = result.split('\n').filter((l) => l.trim());
      const lastLine = lines[lines.length - 1];
      expect(lastLine).toContain('Falar com atendente');
    });
  });
});
