import { CommerceMenuBuilder } from '../../application/services/welcome-menu/builders/CommerceMenuBuilder';
import { MenuBuilderInput } from '../../application/services/welcome-menu/builders/IMenuBuilder';
import { MenuConditions } from '../../application/services/welcome-menu/MenuConditionEvaluator';
import { NicheCategory } from '../../application/services/welcome-menu/NicheClassifier';

describe('CommerceMenuBuilder', () => {
  let builder: CommerceMenuBuilder;

  beforeEach(() => {
    builder = new CommerceMenuBuilder();
  });

  describe('supports', () => {
    it('should support RETAIL', () => {
      expect(builder.supports('RETAIL')).toBe(true);
    });

    it('should support ECOMMERCE', () => {
      expect(builder.supports('ECOMMERCE')).toBe(true);
    });

    it('should support FOOD', () => {
      expect(builder.supports('FOOD')).toBe(true);
    });

    it('should not support other categories', () => {
      expect(builder.supports('HEALTH')).toBe(false);
      expect(builder.supports('BEAUTY')).toBe(false);
      expect(builder.supports('RECOVERY')).toBe(false);
      expect(builder.supports('HOME_SERV')).toBe(false);
      expect(builder.supports('DEFAULT')).toBe(false);
    });
  });

  describe('build — RETAIL', () => {
    const baseConditions: MenuConditions = {
      hasOperatingHours: false,
      hasPromotions: false,
      hasCatalogFiles: false,
      hasCatalogUrl: false,
      hasServices: false,
      hasSchedulingCategories: false,
      hasCommerceCatalog: true,
      hasRecoveryCases: false,
    };

    it('should include core options for RETAIL', () => {
      const input: MenuBuilderInput = {
        companyName: 'Loja Test',
        category: 'RETAIL',
        conditions: baseConditions,
      };

      const result = builder.build(input);

      expect(result).toContain('Pesquisar produtos');
      expect(result).toContain('Meu carrinho');
      expect(result).toContain('Acompanhar pedido');
      expect(result).toContain('Repetir último pedido');
      expect(result).toContain('Política de entrega');
      expect(result).toContain('Falar com atendente');
    });

    it('should include promotions option when hasPromotions is true', () => {
      const input: MenuBuilderInput = {
        companyName: 'Loja Test',
        category: 'RETAIL',
        conditions: { ...baseConditions, hasPromotions: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Promoções e cupons');
    });

    it('should not include promotions option when hasPromotions is false', () => {
      const input: MenuBuilderInput = {
        companyName: 'Loja Test',
        category: 'RETAIL',
        conditions: { ...baseConditions, hasPromotions: false },
      };

      const result = builder.build(input);
      expect(result).not.toContain('Promoções e cupons');
    });

    it('should include operating hours when hasOperatingHours is true', () => {
      const input: MenuBuilderInput = {
        companyName: 'Loja Test',
        category: 'RETAIL',
        conditions: { ...baseConditions, hasOperatingHours: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Horários de funcionamento');
    });

    it('should not include operating hours when hasOperatingHours is false', () => {
      const input: MenuBuilderInput = {
        companyName: 'Loja Test',
        category: 'RETAIL',
        conditions: { ...baseConditions, hasOperatingHours: false },
      };

      const result = builder.build(input);
      expect(result).not.toContain('Horários de funcionamento');
    });
  });

  describe('build — ECOMMERCE', () => {
    const baseConditions: MenuConditions = {
      hasOperatingHours: false,
      hasPromotions: false,
      hasCatalogFiles: false,
      hasCatalogUrl: false,
      hasServices: false,
      hasSchedulingCategories: false,
      hasCommerceCatalog: true,
      hasRecoveryCases: false,
    };

    it('should include core options for ECOMMERCE', () => {
      const input: MenuBuilderInput = {
        companyName: 'E-Shop',
        category: 'ECOMMERCE',
        conditions: baseConditions,
      };

      const result = builder.build(input);

      expect(result).toContain('Pesquisar produtos');
      expect(result).toContain('Meu carrinho');
      expect(result).toContain('Acompanhar pedido');
      expect(result).toContain('Repetir último pedido');
      expect(result).toContain('Entrega e frete');
      expect(result).toContain('Formas de pagamento');
      expect(result).toContain('Falar com atendente');
    });

    it('should include promotions for ECOMMERCE when available', () => {
      const input: MenuBuilderInput = {
        companyName: 'E-Shop',
        category: 'ECOMMERCE',
        conditions: { ...baseConditions, hasPromotions: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Promoções');
    });
  });

  describe('build — FOOD', () => {
    const baseConditions: MenuConditions = {
      hasOperatingHours: false,
      hasPromotions: false,
      hasCatalogFiles: false,
      hasCatalogUrl: false,
      hasServices: false,
      hasSchedulingCategories: false,
      hasCommerceCatalog: true,
      hasRecoveryCases: false,
    };

    it('should include core options for FOOD', () => {
      const input: MenuBuilderInput = {
        companyName: 'Restaurante Bom',
        category: 'FOOD',
        conditions: baseConditions,
      };

      const result = builder.build(input);

      expect(result).toContain('cardápio');
      expect(result).toContain('Fazer pedido');
      expect(result).toContain('Acompanhar pedido');
      expect(result).toContain('Repetir último pedido');
      expect(result).toContain('Entrega e retirada');
      expect(result).toContain('Falar com atendente');
    });

    it('should show "consultar cardápio completo" when hasCatalogFiles', () => {
      const input: MenuBuilderInput = {
        companyName: 'Restaurante Bom',
        category: 'FOOD',
        conditions: { ...baseConditions, hasCatalogFiles: true },
      };

      const result = builder.build(input);
      expect(result).toContain('consultar cardápio completo');
    });

    it('should show "pesquisar itens" when no catalog files', () => {
      const input: MenuBuilderInput = {
        companyName: 'Restaurante Bom',
        category: 'FOOD',
        conditions: { ...baseConditions, hasCatalogFiles: false },
      };

      const result = builder.build(input);
      expect(result).toContain('pesquisar itens');
    });

    it('should include promotions do dia for FOOD when available', () => {
      const input: MenuBuilderInput = {
        companyName: 'Restaurante Bom',
        category: 'FOOD',
        conditions: { ...baseConditions, hasPromotions: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Promoções do dia');
    });

    it('should include operating hours for FOOD when available', () => {
      const input: MenuBuilderInput = {
        companyName: 'Restaurante Bom',
        category: 'FOOD',
        conditions: { ...baseConditions, hasOperatingHours: true },
      };

      const result = builder.build(input);
      expect(result).toContain('Horários de funcionamento');
    });
  });

  describe('menu numbering', () => {
    it('should use emoji numbers in sequence', () => {
      const input: MenuBuilderInput = {
        companyName: 'Loja',
        category: 'RETAIL',
        conditions: {
          hasOperatingHours: true,
          hasPromotions: true,
          hasCatalogFiles: false,
          hasCatalogUrl: false,
          hasServices: false,
          hasSchedulingCategories: false,
          hasCommerceCatalog: true,
          hasRecoveryCases: false,
        },
      };

      const result = builder.build(input);
      expect(result).toContain('1️⃣');
      expect(result).toContain('2️⃣');
      expect(result).toContain('3️⃣');
    });

    it('should end with "Falar com atendente" as last option', () => {
      const input: MenuBuilderInput = {
        companyName: 'Loja',
        category: 'RETAIL',
        conditions: {
          hasOperatingHours: false,
          hasPromotions: false,
          hasCatalogFiles: false,
          hasCatalogUrl: false,
          hasServices: false,
          hasSchedulingCategories: false,
          hasCommerceCatalog: true,
          hasRecoveryCases: false,
        },
      };

      const result = builder.build(input);
      const lines = result.split('\n').filter((l) => l.trim());
      const lastMenuLine = lines[lines.length - 1];
      expect(lastMenuLine).toContain('Falar com atendente');
    });
  });
});
