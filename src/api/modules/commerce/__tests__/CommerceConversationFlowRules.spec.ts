import { CommerceConversationFlowRules } from '../application/services/conversation/CommerceConversationFlowRules';

describe('CommerceConversationFlowRules', () => {
  let flowRules: CommerceConversationFlowRules;

  beforeEach(() => {
    flowRules = new CommerceConversationFlowRules();
  });

  describe('isTransactionalBusiness', () => {
    it('should return true for transactional business types', () => {
      expect(flowRules.isTransactionalBusiness('retail')).toBe(true);
      expect(flowRules.isTransactionalBusiness('food')).toBe(true);
      expect(flowRules.isTransactionalBusiness('ecommerce')).toBe(true);
      expect(flowRules.isTransactionalBusiness('delivery')).toBe(true);
      expect(flowRules.isTransactionalBusiness('restaurante')).toBe(true);
    });

    it('should return false for non-transactional business types', () => {
      expect(flowRules.isTransactionalBusiness('consulting')).toBe(false);
      expect(flowRules.isTransactionalBusiness('healthcare')).toBe(false);
      expect(flowRules.isTransactionalBusiness('education')).toBe(false);
    });

    it('should return false when businessType is null or undefined', () => {
      expect(flowRules.isTransactionalBusiness(null)).toBe(false);
      expect(flowRules.isTransactionalBusiness(undefined)).toBe(false);
    });
  });

  describe('resolveSelectedOption', () => {
    const options = [
      { optionNumber: 1, name: 'Pizza', source: 'CATALOG' as const },
      { optionNumber: 2, name: 'Burger', source: 'CATALOG' as const },
      { optionNumber: 3, name: 'Salad', source: 'CATALOG' as const },
    ];

    it('should resolve option by number from user message', () => {
      const result = flowRules.resolveSelectedOption(options as any, '2');
      expect(result).toMatchObject({ optionNumber: 2, name: 'Burger' });
    });

    it('should return null when message does not contain a valid number', () => {
      const result = flowRules.resolveSelectedOption(options as any, 'quero pizza');
      expect(result).toBeNull();
    });

    it('should return null when option number does not exist', () => {
      const result = flowRules.resolveSelectedOption(options as any, '99');
      expect(result).toBeNull();
    });
  });

  describe('extractPositiveInteger', () => {
    it('should extract a positive integer from a string', () => {
      expect(flowRules.extractPositiveInteger('3')).toBe(3);
      expect(flowRules.extractPositiveInteger('quero o 2')).toBe(2);
    });

    it('should return null for zero or negative-like values', () => {
      expect(flowRules.extractPositiveInteger('0')).toBeNull();
    });

    it('should return null when no number is present', () => {
      expect(flowRules.extractPositiveInteger('hello')).toBeNull();
    });
  });

  describe('isNegativeOrCheckout', () => {
    it('should detect negative/checkout intents (normalized input)', () => {
      // The method expects pre-normalized input (as used in AdvanceConversation)
      expect(flowRules.isNegativeOrCheckout(flowRules.normalize('só isso'))).toBe(true);
      expect(flowRules.isNegativeOrCheckout(flowRules.normalize('fechar pedido'))).toBe(true);
      expect(flowRules.isNegativeOrCheckout(flowRules.normalize('finalizar'))).toBe(true);
      expect(flowRules.isNegativeOrCheckout(flowRules.normalize('não'))).toBe(true);
    });

    it('should return false for unrelated messages', () => {
      expect(flowRules.isNegativeOrCheckout(flowRules.normalize('quero mais'))).toBe(false);
      expect(flowRules.isNegativeOrCheckout(flowRules.normalize('adicionar item'))).toBe(false);
    });
  });

  describe('isPickup / isDelivery', () => {
    it('should detect pickup intent', () => {
      expect(flowRules.isPickup(flowRules.normalize('retirada'))).toBe(true);
      expect(flowRules.isPickup(flowRules.normalize('vou buscar'))).toBe(true);
    });

    it('should detect delivery intent', () => {
      expect(flowRules.isDelivery(flowRules.normalize('entrega'))).toBe(true);
      expect(flowRules.isDelivery(flowRules.normalize('quero entregar'))).toBe(true);
    });

    it('should not confuse pickup with delivery', () => {
      expect(flowRules.isPickup(flowRules.normalize('entrega'))).toBe(false);
      expect(flowRules.isDelivery(flowRules.normalize('retirada'))).toBe(false);
    });
  });

  describe('looksLikeAddress', () => {
    it('should detect address-like strings', () => {
      expect(flowRules.looksLikeAddress('Rua das Flores, 123')).toBe(true);
      expect(flowRules.looksLikeAddress('Avenida Brasil, 456')).toBe(true);
    });

    it('should return false for short or non-address strings', () => {
      expect(flowRules.looksLikeAddress('sim')).toBe(false);
      expect(flowRules.looksLikeAddress('ok')).toBe(false);
    });
  });

  describe('normalize', () => {
    it('should normalize accented characters and lowercase', () => {
      expect(flowRules.normalize('Não')).toBe('nao');
      expect(flowRules.normalize('  Café  ')).toBe('cafe');
      expect(flowRules.normalize('ENTREGA')).toBe('entrega');
    });
  });
});
