// auth e2e new spec
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AuthController } from '../presentation/controllers/AuthController';
import { ILoginUseCase } from '../application/use-cases/interfaces/ILoginUseCase';
import { ILogoutUseCase } from '../application/use-cases/interfaces/ILogoutUseCase';
import { IRefreshTokenUseCase } from '../application/use-cases/interfaces/IRefreshTokenUseCase';
import { IGetCurrentUserUseCase } from '../application/use-cases/interfaces/IGetCurrentUserUseCase';
import { IRequestPasswordResetUseCase } from '../application/use-cases/interfaces/IRequestPasswordResetUseCase';
import { IResetPasswordUseCase } from '../application/use-cases/interfaces/IResetPasswordUseCase';
import { IChangeFirstAccessPasswordUseCase } from '../application/use-cases/interfaces/IChangeFirstAccessPasswordUseCase';
import { TOKEN_SERVICE } from '@shared/application/ports/ITokenService';
import { UnauthorizedException, ValidationErrorException, EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import { DeviceAwareThrottlerGuard } from '../presentation/guards/DeviceAwareThrottlerGuard';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { SubscriptionActiveGuard } from '@shared/infrastructure/auth/guards/SubscriptionActiveGuard';
import { ThrottlerModule } from '@nestjs/throttler';

// ---------------------------------------------------------------------------
// Mock use-case and service factories
// ---------------------------------------------------------------------------
function makeUseCaseMocks() {
  return {
    loginUseCase: { execute: jest.fn() },
    logoutUseCase: { execute: jest.fn().mockResolvedValue(undefined) },
    refreshTokenUseCase: { execute: jest.fn() },
    getCurrentUserUseCase: { execute: jest.fn() },
    requestPasswordResetUseCase: { execute: jest.fn() },
    resetPasswordUseCase: { execute: jest.fn() },
    changeFirstAccessPasswordUseCase: { execute: jest.fn() },
    tokenService: {
      getAccessTokenTtlSeconds: jest.fn().mockReturnValue(900),
      getRefreshTokenTtlSeconds: jest.fn().mockReturnValue(604800),
      signAccessToken: jest.fn().mockResolvedValue('at'),
      signRefreshToken: jest.fn().mockResolvedValue('rt'),
      verifyRefreshToken: jest.fn(),
    },
  };
}

const mockLoginOutput = {
  accessToken: 'access-token-value',
  refreshToken: 'refresh-token-value',
  user: { id: 'u1', tenantId: 't1', name: 'Test', email: 'user@example.com', role: 'ADMIN', mustChangePassword: false, accessibleBranchIds: [] },
  tenant: { id: 't1', name: 'Acme', createdAt: new Date().toISOString(), plan: 'PRO', billingAccess: { pricing: { baseMonthlyPrice: 0, addonsMonthlyPrice: 0, totalMonthlyPrice: 0 }, includedModules: [], addonModules: [], enabledModules: [], moduleAccess: {} } },
};

const mockGetCurrentUserOutput = {
  user: { id: 'u1', tenantId: 't1', name: 'Test', email: 'user@example.com', role: 'ADMIN' as const, mustChangePassword: false },
  tenant: { id: 't1', name: 'Acme', createdAt: new Date().toISOString() },
};

async function buildApp(uc = makeUseCaseMocks()): Promise<{ app: INestApplication; mocks: ReturnType<typeof makeUseCaseMocks> }> {
  const redisMock = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(1), keys: jest.fn().mockResolvedValue([]) };
  const module: TestingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: ILoginUseCase, useValue: uc.loginUseCase },
      { provide: ILogoutUseCase, useValue: uc.logoutUseCase },
      { provide: IRefreshTokenUseCase, useValue: uc.refreshTokenUseCase },
      { provide: IGetCurrentUserUseCase, useValue: uc.getCurrentUserUseCase },
      { provide: IRequestPasswordResetUseCase, useValue: uc.requestPasswordResetUseCase },
      { provide: IResetPasswordUseCase, useValue: uc.resetPasswordUseCase },
      { provide: IChangeFirstAccessPasswordUseCase, useValue: uc.changeFirstAccessPasswordUseCase },
      { provide: TOKEN_SERVICE, useValue: uc.tokenService },
      { provide: REDIS_CLIENT, useValue: redisMock },
      DeviceAwareThrottlerGuard,
      { provide: JwtCookieGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
      { provide: SubscriptionActiveGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
    ],
  })
    .overrideGuard(JwtCookieGuard)
    .useValue({ canActivate: (ctx: any) => { const req = ctx.switchToHttp().getRequest(); req.user = { sub: 'u1', tenantId: 't1', role: 'ADMIN' }; return true; } })
    .overrideGuard(SubscriptionActiveGuard)
    .useValue({ canActivate: jest.fn().mockReturnValue(true) })
    .overrideGuard(DeviceAwareThrottlerGuard)
    .useValue({ canActivate: jest.fn().mockReturnValue(true) })
    .compile();

  const app = module.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();
  return { app, mocks: uc };
}

// ===========================================================================
// 1. POST /auth/login — DTO validation (isolated controller)
// ===========================================================================
describe('POST /auth/login — DTO validation (isolated controller)', () => {
  let app: INestApplication;
  let mocks: ReturnType<typeof makeUseCaseMocks>;

  beforeEach(async () => {
    ({ app, mocks } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when email field is missing', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ password: 'Password123!' })
      .expect(400);
  });

  it('should return 400 when password field is missing', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com' })
      .expect(400);
  });

  it('should return 400 when email is not a valid email format', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'Password123!' })
      .expect(400);
  });

  it('should return 400 when password is shorter than 6 chars', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: '12345' })
      .expect(400);
  });

  it('should return 400 when body is empty', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({})
      .expect(400);
  });

  it('should return 200 and set cookies when login use case succeeds', async () => {
    mocks.loginUseCase.execute.mockResolvedValue(mockLoginOutput);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'Password123!' })
      .expect(200);

    const cookies = res.get('Set-Cookie') || [];
    expect(cookies.some((c) => c.startsWith('atendeai_access='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('atendeai_refresh='))).toBe(true);
  });

  it('should return 401 when login use case throws UnauthorizedException', async () => {
    mocks.loginUseCase.execute.mockRejectedValue(
      new UnauthorizedException('Invalid credentials', 'INVALID_CREDENTIALS'),
    );

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'wrongpass' })
      .expect(401);
  });
});

// ===========================================================================
// 2. GET /auth/me — expired token (isolated controller)
// ===========================================================================
describe('GET /auth/me — expired access token (isolated controller)', () => {
  let app: INestApplication;
  let mocks: ReturnType<typeof makeUseCaseMocks>;

  beforeAll(async () => {
    ({ app, mocks } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 when JWT guard passes and getCurrentUser succeeds', async () => {
    mocks.getCurrentUserUseCase.execute.mockResolvedValue(mockGetCurrentUserOutput);

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(200);

    expect(res.body.data.user.email).toBe('user@example.com');
  });

  it('should call getCurrentUserUseCase.execute with the user sub from JWT', async () => {
    mocks.getCurrentUserUseCase.execute.mockResolvedValue(mockGetCurrentUserOutput);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(200);

    expect(mocks.getCurrentUserUseCase.execute).toHaveBeenCalledWith('u1');
  });

  it('should return 404 when getCurrentUser throws EntityNotFoundException', async () => {
    mocks.getCurrentUserUseCase.execute.mockRejectedValue(
      new EntityNotFoundException('User not found', 'USER_NOT_FOUND'),
    );

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', ['atendeai_access=valid-token'])
      .expect(404);
  });
});

// ===========================================================================
// 3. POST /auth/forgot-password — DTO validation (isolated controller)
// ===========================================================================
describe('POST /auth/forgot-password — DTO validation (isolated controller)', () => {
  let app: INestApplication;
  let mocks: ReturnType<typeof makeUseCaseMocks>;

  beforeEach(async () => {
    ({ app, mocks } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when email field is missing', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({})
      .expect(400);
  });

  it('should return 400 when email format is invalid', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'invalid-email' })
      .expect(400);
  });

  it('should return 200 for valid email even if user does not exist', async () => {
    mocks.requestPasswordResetUseCase.execute.mockResolvedValue({
      message: 'Se o e-mail existir, enviaremos um link para redefinição de senha.',
    });

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'ghost@example.com' })
      .expect(200);
  });

  it('should pass email to requestPasswordResetUseCase.execute', async () => {
    mocks.requestPasswordResetUseCase.execute.mockResolvedValue({ message: 'ok' });

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'real@example.com' })
      .expect(200);

    expect(mocks.requestPasswordResetUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'real@example.com' }),
    );
  });
});

// ===========================================================================
// 4. POST /auth/reset-password — validation + already-used token (isolated)
// ===========================================================================
describe('POST /auth/reset-password — DTO + already-used token (isolated controller)', () => {
  let app: INestApplication;
  let mocks: ReturnType<typeof makeUseCaseMocks>;

  beforeEach(async () => {
    ({ app, mocks } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when token field is missing', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ password: 'NewPassword123!' })
      .expect(400);
  });

  it('should return 400 when password field is missing', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'some-token' })
      .expect(400);
  });

  it('should return 400 when password is shorter than 6 chars', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'some-token', password: '12345' })
      .expect(400);
  });

  it('should return 400 when resetPasswordUseCase throws ValidationErrorException (already-used token)', async () => {
    mocks.resetPasswordUseCase.execute.mockRejectedValue(
      new ValidationErrorException('Token de redefinição inválido'),
    );

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'used-token', password: 'NewPass123!' })
      .expect(400);
  });

  it('should return 200 when reset is successful', async () => {
    mocks.resetPasswordUseCase.execute.mockResolvedValue({
      message: 'Senha redefinida com sucesso.',
    });

    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'valid-token', password: 'NewPass123!' })
      .expect(200);

    expect(res.body.data.message).toBeDefined();
  });
});

// ===========================================================================
// 5. POST /auth/first-access-password — guard + DTO (isolated controller)
// ===========================================================================
describe('POST /auth/first-access-password — JWT guard + DTO (isolated controller)', () => {
  let app: INestApplication;
  let mocks: ReturnType<typeof makeUseCaseMocks>;

  beforeEach(async () => {
    ({ app, mocks } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when password field is missing', async () => {
    await request(app.getHttpServer())
      .post('/auth/first-access-password')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({})
      .expect(400);
  });

  it('should return 400 when password is shorter than 6 chars', async () => {
    await request(app.getHttpServer())
      .post('/auth/first-access-password')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ password: '12345' })
      .expect(400);
  });

  it('should return 200 when use case succeeds', async () => {
    mocks.changeFirstAccessPasswordUseCase.execute.mockResolvedValue({
      message: 'Senha alterada com sucesso.',
    });

    const res = await request(app.getHttpServer())
      .post('/auth/first-access-password')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ password: 'NewPass123!' })
      .expect(200);

    expect(res.body.data.message).toBeDefined();
  });

  it('should pass userId from JWT payload to use case', async () => {
    mocks.changeFirstAccessPasswordUseCase.execute.mockResolvedValue({ message: 'ok' });

    await request(app.getHttpServer())
      .post('/auth/first-access-password')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ password: 'NewPass123!' })
      .expect(200);

    expect(mocks.changeFirstAccessPasswordUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' }),
    );
  });

  it('should return 404 when EntityNotFoundException is thrown', async () => {
    mocks.changeFirstAccessPasswordUseCase.execute.mockRejectedValue(
      new EntityNotFoundException('User not found', 'USER_NOT_FOUND'),
    );

    await request(app.getHttpServer())
      .post('/auth/first-access-password')
      .set('Cookie', ['atendeai_access=valid-token'])
      .send({ password: 'NewPass123!' })
      .expect(404);
  });
});

// ===========================================================================
// 6. POST /auth/refresh — cookie attributes (isolated controller)
// ===========================================================================
describe('POST /auth/refresh — cookie attributes (isolated controller)', () => {
  let app: INestApplication;
  let mocks: ReturnType<typeof makeUseCaseMocks>;

  beforeAll(async () => {
    ({ app, mocks } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 when refresh use case succeeds', async () => {
    mocks.refreshTokenUseCase.execute.mockResolvedValue({
      accessToken: 'new-at',
      refreshToken: 'new-rt',
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', ['atendeai_refresh=rt-value'])
      .expect(200);
  });

  it('should set atendeai_access cookie on successful refresh', async () => {
    mocks.refreshTokenUseCase.execute.mockResolvedValue({
      accessToken: 'new-at',
      refreshToken: 'new-rt',
    });

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', ['atendeai_refresh=rt-value'])
      .expect(200);

    const cookies = res.get('Set-Cookie') || [];
    expect(cookies.some((c) => c.startsWith('atendeai_access='))).toBe(true);
  });

  it('should set HttpOnly on atendeai_access cookie from refresh', async () => {
    mocks.refreshTokenUseCase.execute.mockResolvedValue({
      accessToken: 'new-at',
      refreshToken: 'new-rt',
    });

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', ['atendeai_refresh=rt-value'])
      .expect(200);

    const cookies = res.get('Set-Cookie') || [];
    const accessCookie = cookies.find((c) => c.startsWith('atendeai_access='));
    expect(accessCookie).toContain('HttpOnly');
  });

  it('should return 401 when refresh use case throws UnauthorizedException', async () => {
    mocks.refreshTokenUseCase.execute.mockRejectedValue(
      new UnauthorizedException('Refresh session revoked', 'INVALID_TOKEN'),
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', ['atendeai_refresh=revoked-rt'])
      .expect(401);
  });
});
