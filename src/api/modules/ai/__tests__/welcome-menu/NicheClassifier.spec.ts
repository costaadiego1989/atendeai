import { NicheClassifier, NicheCategory, NicheStrategy } from '../../application/services/welcome-menu/NicheClassifier';

describe('NicheClassifier', () => {
  let classifier: NicheClassifier;

  beforeEach(() => {
    classifier = new NicheClassifier();
  });

  describe('classify', () => {
    describe('COMMERCE strategy niches', () => {
      it.each([
        ['RETAIL', 'RETAIL' as NicheCategory],
      ])('should classify %s as %s', (businessType, expected) => {
        const result = classifier.classify(businessType);
        expect(result.category).toBe(expected);
        expect(result.strategy).toBe('COMMERCE');
      });

      it.each([
        ['ECOMMERCE', 'ECOMMERCE' as NicheCategory],
      ])('should classify %s as %s', (businessType, expected) => {
        const result = classifier.classify(businessType);
        expect(result.category).toBe(expected);
        expect(result.strategy).toBe('COMMERCE');
      });

      it.each([
        ['FOOD', 'FOOD' as NicheCategory],
        ['BAKERY', 'FOOD' as NicheCategory],
        ['CAFETERIA', 'FOOD' as NicheCategory],
        ['SUPERMARKET', 'FOOD' as NicheCategory],
        ['MARKET', 'FOOD' as NicheCategory],
        ['GROCERY', 'FOOD' as NicheCategory],
      ])('should classify %s as %s', (businessType, expected) => {
        const result = classifier.classify(businessType);
        expect(result.category).toBe(expected);
        expect(result.strategy).toBe('COMMERCE');
      });
    });

    describe('SCHEDULING strategy niches', () => {
      it.each([
        ['HEALTH', 'HEALTH' as NicheCategory],
        ['CLINIC', 'HEALTH' as NicheCategory],
        ['SCHEDULING', 'HEALTH' as NicheCategory],
      ])('should classify %s as %s', (businessType, expected) => {
        const result = classifier.classify(businessType);
        expect(result.category).toBe(expected);
        expect(result.strategy).toBe('SCHEDULING');
      });

      it.each([
        ['BEAUTY', 'BEAUTY' as NicheCategory],
        ['PET', 'BEAUTY' as NicheCategory],
        ['GYM', 'BEAUTY' as NicheCategory],
      ])('should classify %s as %s', (businessType, expected) => {
        const result = classifier.classify(businessType);
        expect(result.category).toBe(expected);
        expect(result.strategy).toBe('SCHEDULING');
      });
    });

    describe('RECOVERY strategy niche', () => {
      it('should classify RECOVERY as RECOVERY', () => {
        const result = classifier.classify('RECOVERY');
        expect(result.category).toBe('RECOVERY');
        expect(result.strategy).toBe('RECOVERY');
      });
    });

    describe('CONSULTATIVE strategy niches', () => {
      it.each([
        ['LEGAL', 'HOME_SERV' as NicheCategory],
        ['REALESTATE', 'HOME_SERV' as NicheCategory],
        ['AGENCY', 'HOME_SERV' as NicheCategory],
        ['AUTOMOTIVE', 'HOME_SERV' as NicheCategory],
        ['HOSPITALITY', 'HOME_SERV' as NicheCategory],
        ['SIMPLE_SERVICE', 'HOME_SERV' as NicheCategory],
        ['RENTAL', 'HOME_SERV' as NicheCategory],
        ['OTHER', 'HOME_SERV' as NicheCategory],
      ])('should classify %s as %s (HOME_SERV)', (businessType, expected) => {
        const result = classifier.classify(businessType);
        expect(result.category).toBe(expected);
        expect(result.strategy).toBe('CONSULTATIVE');
      });

      it('should classify EDUCATION as EDUCATION with CONSULTATIVE strategy', () => {
        const result = classifier.classify('EDUCATION');
        expect(result.category).toBe('EDUCATION');
        expect(result.strategy).toBe('CONSULTATIVE');
      });

      it('should classify B2B as B2B with CONSULTATIVE strategy', () => {
        const result = classifier.classify('B2B');
        expect(result.category).toBe('B2B');
        expect(result.strategy).toBe('CONSULTATIVE');
      });
    });

    describe('DEFAULT fallback', () => {
      it('should return DEFAULT for null businessType', () => {
        const result = classifier.classify(null);
        expect(result.category).toBe('DEFAULT');
        expect(result.strategy).toBe('CONSULTATIVE');
      });

      it('should return DEFAULT for undefined businessType', () => {
        const result = classifier.classify(undefined);
        expect(result.category).toBe('DEFAULT');
        expect(result.strategy).toBe('CONSULTATIVE');
      });

      it('should return DEFAULT for empty string', () => {
        const result = classifier.classify('');
        expect(result.category).toBe('DEFAULT');
        expect(result.strategy).toBe('CONSULTATIVE');
      });

      it('should return DEFAULT for unknown businessType', () => {
        const result = classifier.classify('UNKNOWN_TYPE');
        expect(result.category).toBe('DEFAULT');
        expect(result.strategy).toBe('CONSULTATIVE');
      });
    });

    describe('case insensitivity', () => {
      it('should handle lowercase input', () => {
        const result = classifier.classify('retail');
        expect(result.category).toBe('RETAIL');
        expect(result.strategy).toBe('COMMERCE');
      });

      it('should handle mixed case input', () => {
        const result = classifier.classify('Food');
        expect(result.category).toBe('FOOD');
        expect(result.strategy).toBe('COMMERCE');
      });
    });
  });

  describe('getDisplayName', () => {
    it.each([
      ['RETAIL', 'Varejo'],
      ['ECOMMERCE', 'E-commerce'],
      ['FOOD', 'Food & Delivery'],
      ['HEALTH', 'Saúde & Agenda'],
      ['BEAUTY', 'Beleza & Estética'],
      ['RECOVERY', 'Cobrança & Recovery'],
      ['HOME_SERV', 'Serviços Profissionais'],
      ['EDUCATION', 'Educação & Cursos'],
      ['B2B', 'Empresas B2B'],
      ['DEFAULT', 'Geral'],
    ])('should return display name for %s', (category, expected) => {
      expect(classifier.getDisplayName(category as NicheCategory)).toBe(expected);
    });
  });
});
