import { PIIDetector } from '../PIIDetector';

describe('PIIDetector', () => {
  const detector = new PIIDetector();

  describe('detectCPF', () => {
    it('detects formatted CPF (xxx.xxx.xxx-xx)', () => {
      expect(detector.hasPII('Meu CPF é 123.456.789-09')).toBe(true);
    });

    it('detects unformatted CPF (11 digits)', () => {
      expect(detector.hasPII('CPF 12345678909 aqui')).toBe(true);
    });

    it('does not flag CNPJ as CPF', () => {
      expect(detector.hasPII('CNPJ 12.345.678/0001-95')).toBe(false);
    });
  });

  describe('detectCreditCard', () => {
    it('detects card with spaces', () => {
      expect(detector.hasPII('Cartão 4111 1111 1111 1111')).toBe(true);
    });

    it('detects card with dashes', () => {
      expect(detector.hasPII('Número 4111-1111-1111-1111')).toBe(true);
    });

    it('detects card without separators', () => {
      expect(detector.hasPII('Use 4111111111111111 para pagar')).toBe(true);
    });
  });

  describe('detectEmail', () => {
    it('detects email in text', () => {
      expect(detector.hasPII('Envie para joao@gmail.com por favor')).toBe(true);
    });

    it('does not flag domain-only references', () => {
      expect(detector.hasPII('Acesse nosso site em empresa.com.br')).toBe(false);
    });
  });

  describe('detectPhone', () => {
    it('detects (XX) XXXXX-XXXX', () => {
      expect(detector.hasPII('Ligue (11) 99876-5432')).toBe(true);
    });

    it('detects +55 XX XXXXX-XXXX', () => {
      expect(detector.hasPII('WhatsApp +55 21 98765-4321')).toBe(true);
    });

    it('does not flag short numbers', () => {
      expect(detector.hasPII('Pedido 12345 confirmado')).toBe(false);
    });
  });

  describe('no false positives', () => {
    it('normal text without PII', () => {
      expect(detector.hasPII('Olá, como posso ajudar com seu pedido?')).toBe(false);
    });

    it('prices and amounts', () => {
      expect(detector.hasPII('O valor total é R$ 1.234,56')).toBe(false);
    });

    it('dates', () => {
      expect(detector.hasPII('Agendado para 15/08/2026 às 14:00')).toBe(false);
    });

    it('order IDs', () => {
      expect(detector.hasPII('Seu pedido #ABC-123456 está em preparo')).toBe(false);
    });
  });

  describe('getMatches', () => {
    it('returns all PII found with types', () => {
      const matches = detector.getMatches(
        'CPF 123.456.789-09, email joao@teste.com, tel (11) 91234-5678',
      );
      expect(matches).toHaveLength(3);
      expect(matches.map((m) => m.type).sort()).toEqual(['cpf', 'email', 'phone']);
    });

    it('returns empty array for clean text', () => {
      expect(detector.getMatches('Texto limpo sem dados')).toEqual([]);
    });
  });
});
