import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { InstagramMetaConnectionController } from '../presentation/controllers/InstagramMetaConnectionController';
import { StartMetaInstagramConnectionUseCase } from '../application/use-cases/StartMetaInstagramConnectionUseCase';
import { CompleteMetaInstagramConnectionUseCase } from '../application/use-cases/CompleteMetaInstagramConnectionUseCase';
import { MetaInstagramOAuthService } from '../infrastructure/services/MetaInstagramOAuthService';
import { MetaInstagramOAuthStateService } from '../infrastructure/services/MetaInstagramOAuthStateService';
import { TENANT_REPOSITORY } from '../domain/repositories/ITenantRepository';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';

/**
 * Integration e2e for POST /channels/instagram/meta/start.
 *
 * Wires the REAL controller + StartMetaInstagramConnectionUseCase + the real
 * MetaInstagramOAuthService and MetaInstagramOAuthStateService so the returned
 * authorizationUrl reflects the env-driven branch:
 *  - config_id present (Facebook Login for Business) when META_INSTAGRAM_LOGIN_CONFIG_ID set
 *  - classic scope fallback when it is not set
 * Only the tenant repository (DB) and ConfigService are stubbed.
 */
describe('Channels Instagram Meta start (e2e integration)', () => {
  const currentUser = { userId: 'u1', tenantId: 't1', role: 'OWNER' };

  const baseEnv: Record<string, string> = {
    META_APP_ID: 'app-1',
    META_APP_SECRET: 'secret-1',
    META_INSTAGRAM_OAUTH_REDIRECT_URI: 'https://api.example/cb',
  };

  const buildApp = async (
    env: Record<string, string>,
  ): Promise<INestApplication> => {
    const tenantRepository = {
      findById: jest.fn().mockResolvedValue({ id: { toValue: () => 't1' } }),
      listBranches: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [InstagramMetaConnectionController],
      providers: [
        StartMetaInstagramConnectionUseCase,
        MetaInstagramOAuthService,
        MetaInstagramOAuthStateService,
        { provide: TENANT_REPOSITORY, useValue: tenantRepository },
        { provide: StructuredLogEmitter, useValue: { emit: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: <T,>(key: string): T | undefined => env[key] as T | undefined,
          },
        },
        {
          provide: CompleteMetaInstagramConnectionUseCase,
          useValue: { execute: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtCookieGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().user = currentUser;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    return app;
  };

  it('returns authorizationUrl with config_id and no scope when login config id is set', async () => {
    const app = await buildApp({
      ...baseEnv,
      META_INSTAGRAM_LOGIN_CONFIG_ID: 'cfg-test-123',
    });

    const res = await request(app.getHttpServer())
      .post('/channels/instagram/meta/start')
      .send({})
      .expect(200);

    const url: string = res.body.authorizationUrl;
    expect(url).toContain('config_id=cfg-test-123');
    expect(url).not.toContain('scope=');
    expect(url).toContain('state=');

    await app.close();
  });

  it('returns authorizationUrl with classic scope fallback when login config id is absent', async () => {
    const app = await buildApp({ ...baseEnv });

    const res = await request(app.getHttpServer())
      .post('/channels/instagram/meta/start')
      .send({})
      .expect(200);

    const url: string = res.body.authorizationUrl;
    expect(url).toContain('scope=');
    expect(url).not.toContain('config_id=');
    expect(url).toContain('state=');

    await app.close();
  });
});
