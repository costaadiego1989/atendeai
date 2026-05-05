import { AIConfig } from '../domain/entities/AIConfig';
import { WhatsAppConfig } from '../domain/entities/WhatsAppConfig';
import { InstagramConfig } from '../domain/entities/InstagramConfig';

describe('Configuration Entities', () => {
  describe('AIConfig', () => {
    it('should create a valid AIConfig', () => {
      const config = AIConfig.create({
        systemPrompt: 'Este é um prompt do sistema com mais de dez caracteres.',
        tone: 'PROFESSIONAL',
        language: 'pt-BR',
        maxTokensPerResponse: 1000,
        confidenceThreshold: 0.8,
        escalationMessage: 'Transferindo para humano...',
        businessRules: ['Regra 1', 'Regra 2'],
      });

      expect(config.systemPrompt).toBe('Este é um prompt do sistema com mais de dez caracteres.');
      expect(config.tone).toBe('PROFESSIONAL');
      expect(config.maxTokensPerResponse).toBe(1000);
    });

    it('should throw error for short prompt', () => {
      expect(() => AIConfig.create({
        systemPrompt: 'Curto',
        tone: 'CASUAL',
        language: 'pt-BR',
        maxTokensPerResponse: 100,
        confidenceThreshold: 0.5,
        escalationMessage: null,
        businessRules: [],
      })).toThrow('System prompt must have at least 10 characters');
    });

    it('should throw error for invalid confidence threshold', () => {
      const props = {
        systemPrompt: 'Prompt válido o suficiente',
        tone: 'CASUAL' as const,
        language: 'pt-BR',
        maxTokensPerResponse: 100,
        confidenceThreshold: 1.5,
        escalationMessage: null,
        businessRules: [],
      };
      expect(() => AIConfig.create(props)).toThrow('Confidence threshold must be between 0 and 1');
    });
  });

  describe('WhatsAppConfig', () => {
    it('should create a valid WhatsAppConfig', () => {
      const config = WhatsAppConfig.create({
        provider: 'BUBBLEWHATS',
        credentials: { id: '7071', token: 'token', apiUrl: 'https://api.test' },
        whatsappNumber: '5511999998888',
        webhookSecret: 'secret',
      });

      expect(config.provider).toBe('BUBBLEWHATS');
      expect(config.status).toBe('PENDING_VERIFICATION');
    });

    it('should throw if credentials are missing for BubbleWhats', () => {
      expect(() => WhatsAppConfig.create({
        provider: 'BUBBLEWHATS',
        credentials: { id: '7071' },
        whatsappNumber: '5511999998888',
        webhookSecret: null,
      })).toThrow('BubbleWhats token is required');
    });

    it('should activate the config', () => {
      const config = WhatsAppConfig.create({
        provider: 'TWILIO',
        credentials: { accountSid: 'sid', authToken: 'token' },
        whatsappNumber: '5511999998888',
        webhookSecret: null,
      });
      config.activate();
      expect(config.status).toBe('ACTIVE');
    });
  });

  describe('InstagramConfig', () => {
    it('should create a valid InstagramConfig', () => {
      const config = InstagramConfig.create({
        metaAccessToken: 'token',
        instagramAccountId: 'ig-123',
        webhookSecret: 'ig-secret',
      });

      expect(config.instagramAccountId).toBe('ig-123');
      expect(config.status).toBe('PENDING_VERIFICATION');
    });

    it('should activate the config', () => {
      const config = InstagramConfig.create({
        metaAccessToken: 'token',
        instagramAccountId: 'ig-123',
        webhookSecret: 'ig-secret',
      });
      config.activate();
      expect(config.status).toBe('ACTIVE');
    });
  });
});
