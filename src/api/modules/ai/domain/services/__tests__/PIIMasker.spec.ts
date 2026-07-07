import { PIIMasker } from '../PIIMasker';

describe('PIIMasker', () => {
  let masker: PIIMasker;

  beforeEach(() => {
    masker = new PIIMasker();
  });

  describe('mask()', () => {
    it('returns original text when no PII found', () => {
      const result = masker.mask('Olá, como posso ajudar?');
      expect(result.masked).toBe('Olá, como posso ajudar?');
      expect(result.maskedCount).toBe(0);
      expect(result.maskMap).toHaveLength(0);
    });

    describe('CPF masking', () => {
      it('masks formatted CPF (xxx.xxx.xxx-xx)', () => {
        const result = masker.mask('Seu CPF é 123.456.789-00.');
        expect(result.masked).toBe('Seu CPF é ***.***.***-**.');
        expect(result.maskedCount).toBe(1);
        expect(result.maskMap[0].type).toBe('cpf');
        expect(result.maskMap[0].original).toBe('123.456.789-00');
      });

      it('masks unformatted CPF (11 digits)', () => {
        // Unformatted 11-digit CPF without phone-like DDD prefix
        const result = masker.mask('CPF: 00011122233 aqui');
        // Either CPF or phone masking applies — what matters is the digits are hidden
        expect(result.masked).not.toContain('00011122233');
        expect(result.maskedCount).toBeGreaterThanOrEqual(1);
      });
    });

    describe('credit card masking', () => {
      it('masks credit card with spaces', () => {
        const result = masker.mask('Cartão: 4111 1111 1111 1111');
        expect(result.masked).toBe('Cartão: **** **** **** ****');
        expect(result.maskedCount).toBe(1);
        expect(result.maskMap[0].type).toBe('credit_card');
      });

      it('masks credit card with dashes', () => {
        const result = masker.mask('Card 4111-1111-1111-1111 ok');
        expect(result.masked).toBe('Card **** **** **** **** ok');
        expect(result.maskedCount).toBe(1);
      });
    });

    describe('email masking', () => {
      it('masks email preserving domain', () => {
        const result = masker.mask('Email: usuario@empresa.com.br');
        expect(result.masked).toBe('Email: u*****o@empresa.com.br');
        expect(result.maskedCount).toBe(1);
        expect(result.maskMap[0].type).toBe('email');
      });

      it('masks short local part', () => {
        const result = masker.mask('ab@x.com');
        expect(result.masked).toBe('**@x.com');
      });
    });

    describe('phone masking', () => {
      it('masks BR phone with area code', () => {
        const result = masker.mask('Ligue para (11) 98765-4321');
        expect(result.masked).toContain('4321');
        expect(result.masked).not.toContain('98765');
        expect(result.maskedCount).toBe(1);
        expect(result.maskMap[0].type).toBe('phone');
      });

      it('masks phone with +55 prefix', () => {
        const result = masker.mask('WhatsApp: +55 11 987654321');
        expect(result.masked).toContain('4321');
        expect(result.masked).not.toContain('98765');
      });
    });

    describe('multiple PII in same text', () => {
      it('masks all PII occurrences', () => {
        const text =
          'CPF 123.456.789-00 email teste@mail.com tel (11) 91234-5678';
        const result = masker.mask(text);
        expect(result.maskedCount).toBe(3);
        expect(result.masked).not.toContain('123.456.789-00');
        expect(result.masked).not.toContain('teste@mail.com');
        expect(result.masked).not.toContain('91234');
      });

      it('preserves order in maskMap', () => {
        const text = '123.456.789-00 e teste@mail.com';
        const result = masker.mask(text);
        expect(result.maskMap[0].index).toBeLessThan(
          result.maskMap[1].index,
        );
      });
    });

    describe('CNPJ is not masked (business data)', () => {
      it('does not mask CNPJ', () => {
        const result = masker.mask('CNPJ: 12.345.678/0001-90');
        expect(result.masked).toBe('CNPJ: 12.345.678/0001-90');
        expect(result.maskedCount).toBe(0);
      });
    });

    it('preserves surrounding text structure', () => {
      const text = 'Olá! Seu CPF 123.456.789-00 foi verificado. Obrigado!';
      const result = masker.mask(text);
      expect(result.masked).toBe(
        'Olá! Seu CPF ***.***.***-** foi verificado. Obrigado!',
      );
      expect(result.originalLength).toBe(text.length);
    });
  });

  describe('hasPII()', () => {
    it('returns true when PII present', () => {
      expect(masker.hasPII('CPF: 123.456.789-00')).toBe(true);
    });

    it('returns false when no PII', () => {
      expect(masker.hasPII('Texto normal sem dados')).toBe(false);
    });
  });
});
