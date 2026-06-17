import { ConfigService } from '@nestjs/config';
import { MetaInstagramOAuthService } from '../infrastructure/services/MetaInstagramOAuthService';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

describe('MetaInstagramOAuthService.buildAuthorizationUrl', () => {
  function makeService(config: Record<string, string>) {
    const configService = {
      get: jest.fn((key: string) => config[key]),
    } as unknown as ConfigService;
    const structuredLog = { emit: jest.fn() } as unknown as StructuredLogEmitter;
    return new MetaInstagramOAuthService(configService, structuredLog);
  }

  const baseConfig = {
    META_APP_ID: 'app-id',
    META_APP_SECRET: 'app-secret',
    META_INSTAGRAM_OAUTH_REDIRECT_URI: 'https://api.example.com/callback',
  };

  it('throws when platform credentials are missing', () => {
    const service = makeService({});
    expect(() => service.buildAuthorizationUrl('state-123')).toThrow(
      ValidationErrorException,
    );
  });

  it('uses config_id (Facebook Login for Business) and omits raw scope when configured', () => {
    const service = makeService({
      ...baseConfig,
      META_INSTAGRAM_LOGIN_CONFIG_ID: 'login-config-789',
    });

    const url = new URL(service.buildAuthorizationUrl('state-123'));

    expect(url.searchParams.get('client_id')).toBe('app-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.example.com/callback',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('config_id')).toBe('login-config-789');
    expect(url.searchParams.get('state')).toBe('state-123');
    // Facebook Login for Business derives permissions from the configuration;
    // sending raw scope alongside config_id triggers the "no supported
    // permission" rejection, so scope must be absent.
    expect(url.searchParams.get('scope')).toBeNull();
  });

  it('falls back to raw scope when no config_id is set (classic Facebook Login)', () => {
    const service = makeService(baseConfig);

    const url = new URL(service.buildAuthorizationUrl('state-123'));

    expect(url.searchParams.get('config_id')).toBeNull();
    expect(url.searchParams.get('scope')).toBe(
      'pages_show_list,business_management,instagram_basic',
    );
  });
});
