import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { SuccessResponseInterceptor } from '@shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';

describe('AuthController edge cases (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  const email = 'auth-edge@test.com';
  const password = 'Password123!';
  const testCnpj = `ae${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new SuccessResponseInterceptor());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.user.deleteMany({ where: { email } }).catch(() => {});

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Auth Edge Corp',
        cnpj: testCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        tenantId,
        email,
        name: 'Auth Edge User',
        phone: '11999999998',
        passwordHash,
        role: 'OWNER',
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email } }).catch(() => {});
      if (tenantId) {
        await prisma.subscription.deleteMany({ where: { tenantId } }).catch(() => {});
        await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
      }
    }
  });

  it('should reject refresh when the cookie is missing', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);
  });

  it('should allow idempotent logout without a refresh cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .expect(200);

    const cookies = response.get('Set-Cookie') || [];
    expect(cookies.some((cookie) => cookie.includes('Path=/'))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes('atendeai_access=;'))).toBe(
      true,
    );
    expect(cookies.some((cookie) => cookie.includes('atendeai_refresh=;'))).toBe(
      true,
    );
  });

  it('should clear cookies with the root path on logout', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    const authCookie = loginResponse.get('Set-Cookie') || [];

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', authCookie)
      .expect(200);

    const cookies = response.get('Set-Cookie') || [];
    expect(cookies.every((cookie) => cookie.includes('Path=/'))).toBe(true);
  });

  it('should reject /me when the access token cookie is invalid', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', ['atendeai_access=invalid-token'])
      .expect(401);
  });
});
