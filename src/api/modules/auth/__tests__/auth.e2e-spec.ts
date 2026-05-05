import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { SuccessResponseInterceptor } from '@shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { DeviceIdInterceptor } from '@shared/infrastructure/http/interceptors/DeviceIdInterceptor';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import Redis from 'ioredis';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  const testUserEmail = 'test-e2e@example.com';
  const testPassword = 'Password123!';
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new DeviceIdInterceptor());
    app.useGlobalInterceptors(new SuccessResponseInterceptor());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(REDIS_CLIENT);

    // Cleanup and Seed
    await prisma.user.deleteMany({ where: { email: testUserEmail } });

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'E2E Test Corp',
        cnpj: '11222333000199',
        plan: 'PROFISSIONAL',
      },
    });
    tenantId = tenant.id;

    const passwordHash = await bcrypt.hash(testPassword, 10);
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: testUserEmail,
        name: 'E2E Tester',
        phone: '11999999999',
        passwordHash,
        role: 'ADMIN',
      },
    });
  });

  afterAll(async () => {
    if (redis) {
      const throttleKeys = await redis.keys('auth:throttle:*');
      if (throttleKeys.length > 0) {
        await redis.del(...throttleKeys);
      }
    }
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: testUserEmail } });
      if (tenantId) {
        await prisma.tenant.delete({ where: { id: tenantId } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('/api/v1/auth/login (POST) - Success', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testUserEmail,
        password: testPassword,
      })
      .expect(200);

    expect(response.body.data.user).toBeDefined();
    expect(response.body.data.user.email).toBe(testUserEmail);
    expect(response.body.data.tenant).toEqual(
      expect.objectContaining({
        id: tenantId,
        name: 'E2E Test Corp',
      }),
    );

    // Check cookies
    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    if (cookies) {
      expect(cookies.some((c) => c.includes('atendeai_access'))).toBeTruthy();
      expect(cookies.some((c) => c.includes('atendeai_refresh'))).toBeTruthy();
    }
  });

  it('/api/v1/auth/login (POST) - Invalid Credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testUserEmail,
        password: 'wrong-password',
      })
      .expect(401);
  });

  it('/api/v1/auth/login (POST) - should persist a device cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testUserEmail,
        password: testPassword,
      })
      .expect(200);

    const cookies = response.get('Set-Cookie') || [];
    const deviceCookie = cookies.find((cookie) =>
      cookie.includes('device_id='),
    );

    expect(deviceCookie).toBeDefined();
    expect(deviceCookie).toContain('HttpOnly');
  });

  it('/api/v1/auth/me (GET) - Success', async () => {
    // First login to get cookies
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testUserEmail,
        password: testPassword,
      });

    const authCookie = loginResponse.get('Set-Cookie') || [];

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', authCookie)
      .expect(200);

    expect(response.body.data.user.email).toBe(testUserEmail);
    expect(response.body.data.user.role).toBe('ADMIN');
    expect(response.body.data.tenant.name).toBe('E2E Test Corp');
  });

  it('/api/v1/auth/me (GET) - Unauthorized', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('/api/v1/auth/logout (POST)', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testUserEmail,
        password: testPassword,
      });

    const authCookie = loginResponse.get('Set-Cookie') || [];

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', authCookie)
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    if (cookies) {
      expect(cookies.some((c) => c.includes('atendeai_access=;'))).toBeTruthy();
    }
  });

  it('/api/v1/auth/refresh (POST) - revoked after logout', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testUserEmail,
        password: testPassword,
      })
      .expect(200);

    const authCookie = loginResponse.get('Set-Cookie') || [];

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', authCookie)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', authCookie)
      .expect(401);
  });

  it('/api/v1/auth/login (POST) - should throttle repeated attempts by device and ip', async () => {
    const throttleKeys = await redis.keys('auth:throttle:*');
    if (throttleKeys.length > 0) {
      await redis.del(...throttleKeys);
    }

    const fixedDeviceCookie = 'device_id=fixed-test-device';

    for (let attempt = 0; attempt < 12; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Cookie', [fixedDeviceCookie])
        .send({
          email: testUserEmail,
          password: 'wrong-password',
        })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', [fixedDeviceCookie])
      .send({
        email: testUserEmail,
        password: 'wrong-password',
      })
      .expect(429);
  });
});
