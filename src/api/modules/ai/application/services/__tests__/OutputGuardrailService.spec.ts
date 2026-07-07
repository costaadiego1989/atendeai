import { OutputGuardrailService } from '../OutputGuardrailService';

describe('OutputGuardrailService', () => {
  let service: OutputGuardrailService;

  beforeEach(() => {
    service = new OutputGuardrailService();
  });

  describe('clean output', () => {
    it('returns safe: true for normal text', () => {
      const result = service.evaluate(
        'Olá! Posso ajudar com seu pedido. O valor é R$ 59,90.',
      );
      expect(result.safe).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.sanitized).toBe(
        'Olá! Posso ajudar com seu pedido. O valor é R$ 59,90.',
      );
    });

    it('allows whitelisted URLs (WhatsApp, Instagram) — no URL violation', () => {
      const result = service.evaluate(
        'Fale conosco: https://wa.me/5511999998888',
      );
      const urlViolations = result.violations.filter(
        (v) => v.type === 'EXTERNAL_URL',
      );
      expect(urlViolations).toHaveLength(0);
    });
  });

  describe('PII detection', () => {
    it('flags CPF and sanitizes', () => {
      const result = service.evaluate(
        'Seu CPF é 123.456.789-00, confirma?',
      );
      expect(result.safe).toBe(false);
      expect(result.violations).toContainEqual({
        type: 'PII_DETECTED',
        detail: 'cpf detected',
      });
      expect(result.sanitized).not.toContain('123.456.789-00');
      expect(result.sanitized).toContain('***.***.***-**');
    });

    it('flags email and sanitizes', () => {
      const result = service.evaluate(
        'Envie para cliente@empresa.com.br os dados',
      );
      expect(result.safe).toBe(false);
      expect(result.violations.some((v) => v.detail.includes('email'))).toBe(
        true,
      );
      expect(result.sanitized).not.toContain('cliente@empresa.com.br');
    });
  });

  describe('external URL detection', () => {
    it('flags external URL', () => {
      const result = service.evaluate(
        'Acesse http://malicious-site.com/phish para mais info',
      );
      expect(result.safe).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ type: 'EXTERNAL_URL' }),
      );
      expect(result.sanitized).toContain('[link removido]');
      expect(result.sanitized).not.toContain('malicious-site.com');
    });

    it('does not flag wa.me or instagram URLs', () => {
      const result = service.evaluate(
        'Links: https://wa.me/123 e https://instagram.com/perfil',
      );
      expect(
        result.violations.filter((v) => v.type === 'EXTERNAL_URL'),
      ).toHaveLength(0);
    });
  });

  describe('toxic content', () => {
    it('flags toxic word', () => {
      const result = service.evaluate('Você é um idiota por perguntar isso');
      expect(result.safe).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ type: 'TOXIC_CONTENT' }),
      );
      expect(result.sanitized).not.toContain('idiota');
      expect(result.sanitized).toContain('***');
    });

    it('detects case-insensitive toxic patterns', () => {
      const result = service.evaluate('Que MERDA de atendimento');
      expect(result.safe).toBe(false);
      expect(result.violations.some((v) => v.type === 'TOXIC_CONTENT')).toBe(
        true,
      );
    });
  });

  describe('multiple violations', () => {
    it('reports all violations together', () => {
      const result = service.evaluate(
        'CPF 123.456.789-00, site http://evil.com e idiota',
      );
      expect(result.safe).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(3);

      const types = result.violations.map((v) => v.type);
      expect(types).toContain('PII_DETECTED');
      expect(types).toContain('EXTERNAL_URL');
      expect(types).toContain('TOXIC_CONTENT');

      expect(result.sanitized).not.toContain('123.456.789-00');
      expect(result.sanitized).not.toContain('evil.com');
      expect(result.sanitized).not.toContain('idiota');
    });
  });
});
