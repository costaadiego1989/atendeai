import { ConsultativeMenuBuilder } from '../../application/services/welcome-menu/builders/ConsultativeMenuBuilder';
import { MenuBuilderInput } from '../../application/services/welcome-menu/builders/IMenuBuilder';
import { MenuConditions } from '../../application/services/welcome-menu/MenuConditionEvaluator';

describe('ConsultativeMenuBuilder', () => {
  let builder: ConsultativeMenuBuilder;

  beforeEach(() => {
    builder = new ConsultativeMenuBuilder();
  });

  describe('supports', () => {
    it('should support HOME_SERV', () => {
      expect(builder.supports('HOME_SERV')).toBe(true);
    });

    it('should not support other categories', () => {
      expect(builder.supports('RETAIL')).toBe(false);
      expect(builder.supports('HEALTH')).toBe(false);
      expect(builder.supports('RECOVERY')).toBe(false);
      expect(builder.supports('EDUCATION')).toBe(false);
      expect(builder.supports('B2B')).toBe(false);
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
        companyName: 'Escritório ABC',
        category: 'HOME_SERV',
        conditions: baseConditions,
      };

      const result = builder.build(input);

      expect(result).toContain('Nossos serviços');
      expect(result).toContain('Solicitar orçamento');
      expect(result).toContain('Acompanhar proposta');
      expect(result).toContain('Falar com atendente');
    });

    it('should include scheduling option when hasSchedulingCategories', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escritório ABC',
        category: 'HOME_SERV',
        conditions: { ...baseConditions, hasSchedulingCategories: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Agendar reunião ou visita');
    });

    it('should not include scheduling option when no categories', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escritório ABC',
        category: 'HOME_SERV',
        conditions: { ...baseConditions, hasSchedulingCategories: false },
      };

      const result = builder.build(input);
      expect(result).not.toContain('Agendar reunião ou visita');
    });

    it('should include operating hours when available', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escritório ABC',
        category: 'HOME_SERV',
        conditions: { ...baseConditions, hasOperatingHours: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Horários de atendimento');
    });

    it('should include documents option when hasCatalogFiles', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escritório ABC',
        category: 'HOME_SERV',
        conditions: { ...baseConditions, hasCatalogFiles: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Documentos e materiais');
    });

    it('should not include documents option when no catalog files', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escritório ABC',
        category: 'HOME_SERV',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      expect(result).not.toContain('Documentos e materiais');
    });

    it('should use emoji numbers in sequence', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escritório ABC',
        category: 'HOME_SERV',
        conditions: {
          ...baseConditions,
          hasSchedulingCategories: true,
          hasOperatingHours: true,
          hasCatalogFiles: true,
        },
      };

      const result = builder.build(input);
      expect(result).toContain('1️⃣');
      expect(result).toContain('2️⃣');
      expect(result).toContain('3️⃣');
    });

    it('should end with "Falar com atendente"', () => {
      const input: MenuBuilderInput = {
        companyName: 'Escritório ABC',
        category: 'HOME_SERV',
        conditions: baseConditions,
      };

      const result = builder.build(input);
      const lines = result.split('\n').filter((l) => l.trim());
      const lastLine = lines[lines.length - 1];
      expect(lastLine).toContain('Falar com atendente');
    });
  });
});
