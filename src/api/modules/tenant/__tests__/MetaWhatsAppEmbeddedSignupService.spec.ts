import axios from 'axios';
import { MetaWhatsAppEmbeddedSignupService } from '../infrastructure/services/MetaWhatsAppEmbeddedSignupService';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const makeConfigService = (appId = 'app-id-123', appSecret = 'app-secret-456') => ({
  get: jest.fn((key: string) => {
    if (key === 'META_APP_ID') return appId;
    if (key === 'META_APP_SECRET') return appSecret;
    if (key === 'META_GRAPH_API_VERSION') return 'v21.0';
    return undefined;
  }),
});

describe('MetaWhatsAppEmbeddedSignupService', () => {
  let service: MetaWhatsAppEmbeddedSignupService;
  let configService: ReturnType<typeof makeConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = makeConfigService();
    service = new MetaWhatsAppEmbeddedSignupService(configService as any);
  });

  // ─── exchangeCodeForAccessToken ────────────────────────────────────────────

  describe('exchangeCodeForAccessToken', () => {
    it('exchanges code for access token and returns it', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({
        data: { access_token: 'long-lived-tok' },
      });

      const result = await service.exchangeCodeForAccessToken('auth-code-xyz', 'tenant-1');

      expect(result).toEqual({ accessToken: 'long-lived-tok' });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/oauth/access_token',
        expect.objectContaining({
          params: expect.objectContaining({
            client_id: 'app-id-123',
            client_secret: 'app-secret-456',
            code: 'auth-code-xyz',
          }),
        }),
      );
    });

    it('rejects with ValidationErrorException when code is empty', async () => {
      await expect(service.exchangeCodeForAccessToken('', 'tenant-1')).rejects.toThrow(
        ValidationErrorException,
      );
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('rejects with ValidationErrorException when code is only whitespace', async () => {
      await expect(service.exchangeCodeForAccessToken('   ', 'tenant-1')).rejects.toThrow(
        ValidationErrorException,
      );
    });

    it('rejects with ValidationErrorException when response has no access_token', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({ data: {} });

      await expect(service.exchangeCodeForAccessToken('valid-code', 'tenant-1')).rejects.toThrow(
        ValidationErrorException,
      );
    });

    it('propagates axios network error without swallowing', async () => {
      const networkError = new Error('network error');
      mockedAxios.get = jest.fn().mockRejectedValue(networkError);

      await expect(service.exchangeCodeForAccessToken('valid-code', 'tenant-1')).rejects.toThrow(
        'network error',
      );
    });

    it('rejects with ValidationErrorException when META_APP_ID is not configured', async () => {
      configService = makeConfigService('', 'app-secret-456');
      service = new MetaWhatsAppEmbeddedSignupService(configService as any);

      await expect(service.exchangeCodeForAccessToken('valid-code', 'tenant-1')).rejects.toThrow(
        ValidationErrorException,
      );
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('rejects with ValidationErrorException when META_APP_SECRET is not configured', async () => {
      configService = makeConfigService('app-id-123', '');
      service = new MetaWhatsAppEmbeddedSignupService(configService as any);

      await expect(service.exchangeCodeForAccessToken('valid-code', 'tenant-1')).rejects.toThrow(
        ValidationErrorException,
      );
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  // ─── subscribeAppToWaba ────────────────────────────────────────────────────

  describe('subscribeAppToWaba', () => {
    it('posts to correct subscribed_apps endpoint with bearer token', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({ data: { success: true } });

      await service.subscribeAppToWaba('waba-456', 'long-lived-tok', 'tenant-1');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/waba-456/subscribed_apps',
        undefined,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer long-lived-tok' }),
        }),
      );
    });

    it('rejects with ValidationErrorException when wabaId is empty', async () => {
      await expect(service.subscribeAppToWaba('', 'tok', 'tenant-1')).rejects.toThrow(
        ValidationErrorException,
      );
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('propagates axios error when subscription fails', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue(new Error('subscribe failed'));

      await expect(service.subscribeAppToWaba('waba-456', 'tok', 'tenant-1')).rejects.toThrow(
        'subscribe failed',
      );
    });
  });
});
