import { MenuConditionEvaluator, MenuConditions, MenuConditionInput } from '../../application/services/welcome-menu/MenuConditionEvaluator';

describe('MenuConditionEvaluator', () => {
  let evaluator: MenuConditionEvaluator;

  beforeEach(() => {
    evaluator = new MenuConditionEvaluator();
  });

  describe('evaluate', () => {
    it('should return all false for empty tenant data', () => {
      const input: MenuConditionInput = {
        operatingHours: null,
        promotions: [],
        catalogFiles: [],
        catalogUrl: null,
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = evaluator.evaluate(input);

      expect(result).toEqual<MenuConditions>({
        hasOperatingHours: false,
        hasPromotions: false,
        hasCatalogFiles: false,
        hasCatalogUrl: false,
        hasServices: false,
        hasSchedulingCategories: false,
        hasCommerceCatalog: false,
        hasRecoveryCases: false,
      });
    });

    it('should detect operating hours when present and not all closed', () => {
      const input: MenuConditionInput = {
        operatingHours: {
          monday: { open: '08:00', close: '18:00' },
          tuesday: { open: '08:00', close: '18:00' },
        },
        promotions: [],
        catalogFiles: [],
        catalogUrl: null,
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = evaluator.evaluate(input);
      expect(result.hasOperatingHours).toBe(true);
    });

    it('should return false for operating hours when all days are closed', () => {
      const input: MenuConditionInput = {
        operatingHours: {
          monday: { open: '08:00', close: '18:00', closed: true },
          tuesday: { open: '08:00', close: '18:00', closed: true },
        },
        promotions: [],
        catalogFiles: [],
        catalogUrl: null,
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = evaluator.evaluate(input);
      expect(result.hasOperatingHours).toBe(false);
    });

    it('should detect promotions when array has items', () => {
      const input: MenuConditionInput = {
        operatingHours: null,
        promotions: [{ title: 'Promo 1', description: '10% off', value: '10%' }],
        catalogFiles: [],
        catalogUrl: null,
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = evaluator.evaluate(input);
      expect(result.hasPromotions).toBe(true);
    });

    it('should detect catalog files when array has items', () => {
      const input: MenuConditionInput = {
        operatingHours: null,
        promotions: [],
        catalogFiles: ['menu.pdf', 'prices.pdf'],
        catalogUrl: null,
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = evaluator.evaluate(input);
      expect(result.hasCatalogFiles).toBe(true);
    });

    it('should detect catalog URL when present', () => {
      const input: MenuConditionInput = {
        operatingHours: null,
        promotions: [],
        catalogFiles: [],
        catalogUrl: 'https://example.com/catalog',
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = evaluator.evaluate(input);
      expect(result.hasCatalogUrl).toBe(true);
    });

    it('should detect services when string is non-empty', () => {
      const input: MenuConditionInput = {
        operatingHours: null,
        promotions: [],
        catalogFiles: [],
        catalogUrl: null,
        services: 'Corte, Barba, Combo',
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = evaluator.evaluate(input);
      expect(result.hasServices).toBe(true);
    });

    it('should return false for services when string is whitespace only', () => {
      const input: MenuConditionInput = {
        operatingHours: null,
        promotions: [],
        catalogFiles: [],
        catalogUrl: null,
        services: '   ',
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = evaluator.evaluate(input);
      expect(result.hasServices).toBe(false);
    });

    it('should detect scheduling categories when array has items', () => {
      const input: MenuConditionInput = {
        operatingHours: null,
        promotions: [],
        catalogFiles: [],
        catalogUrl: null,
        services: null,
        schedulingCategories: [{ id: '1', name: 'Corte' }],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: false,
      };

      const result = evaluator.evaluate(input);
      expect(result.hasSchedulingCategories).toBe(true);
    });

    it('should detect commerce catalog when item count > 0', () => {
      const input: MenuConditionInput = {
        operatingHours: null,
        promotions: [],
        catalogFiles: [],
        catalogUrl: null,
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 15,
        hasRecoveryCases: false,
      };

      const result = evaluator.evaluate(input);
      expect(result.hasCommerceCatalog).toBe(true);
    });

    it('should detect recovery cases when flag is true', () => {
      const input: MenuConditionInput = {
        operatingHours: null,
        promotions: [],
        catalogFiles: [],
        catalogUrl: null,
        services: null,
        schedulingCategories: [],
        commerceCatalogItemCount: 0,
        hasRecoveryCases: true,
      };

      const result = evaluator.evaluate(input);
      expect(result.hasRecoveryCases).toBe(true);
    });

    it('should evaluate all conditions together', () => {
      const input: MenuConditionInput = {
        operatingHours: { monday: { open: '09:00', close: '17:00' } },
        promotions: [{ title: 'Black Friday', description: '50% off', value: '50%' }],
        catalogFiles: ['cardapio.pdf'],
        catalogUrl: 'https://loja.com',
        services: 'Delivery, Retirada',
        schedulingCategories: [{ id: '1', name: 'Consulta' }],
        commerceCatalogItemCount: 42,
        hasRecoveryCases: true,
      };

      const result = evaluator.evaluate(input);

      expect(result).toEqual<MenuConditions>({
        hasOperatingHours: true,
        hasPromotions: true,
        hasCatalogFiles: true,
        hasCatalogUrl: true,
        hasServices: true,
        hasSchedulingCategories: true,
        hasCommerceCatalog: true,
        hasRecoveryCases: true,
      });
    });
  });
});
