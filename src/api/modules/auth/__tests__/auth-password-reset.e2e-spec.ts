import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { SuccessResponseInterceptor } from '@shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { PASSWORD_RESET_EMAIL_SENDER } from '../application/ports/IPasswordResetEmailSender';

describe('Auth password reset flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  const email = 'auth-reset@test.com';
  const password = 'Password123!';
  const newPassword = 'NewPassword123!';
  const emailSenderMock = {
    send: jest.fn<Promise<void>, [unknown]>(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PASSWORD_RESET_EMAIL_SENDER)
      .useValue(emailSenderMock)
      .compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new SuccessResponseInterceptor());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.user.deleteMany({ where: { email } }).catch(() => { });
    await prisma.$executeRaw(Prisma.sql(`
      CREATE TABLE IF NOT EXISTS shared_schema.password_reset_tokens (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        email VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id)
      )
    `);
    await prisma.$executeRaw(Prisma.sql(`
      CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_key
      ON shared_schema.password_reset_tokens(token_hash)
    `);
    await prisma.$executeRaw(Prisma.sql(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_exp
      ON shared_schema.password_reset_tokens(user_id, expires_at)
    `);
    await prisma.$executeRaw(Prisma.sql(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email_exp
      ON shared_schema.password_reset_tokens(email, expires_at)
    `);
    await prisma.$executeRaw(Prisma.sql(
      `
        DELETE FROM shared_schema.password_reset_tokens
        WHERE email = $1
      `,
      email,
    );

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Auth Reset Corp',
        cnpj: '11222333000188',
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        tenantId,
        email,
        name: 'Auth Reset User',
        phone: '11999999997',
        passwordHash,
        role: 'OWNER',
      },
    });
  });

  afterEach(async () => {
    emailSenderMock.send.mockReset();
    await prisma.$executeRaw(Prisma.sql(
      `
        DELETE FROM shared_schema.password_reset_tokens
        WHERE email = $1
      `,
      email,
    );
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email } }).catch(() => { });
      await prisma.$executeRaw(Prisma.sql(
        `
          DELETE FROM shared_schema.password_reset_tokens
          WHERE email = $1
        `,
        email,
      );
      if (tenantId) {
        await prisma.subscription
          .deleteMany({ where: { tenantId } })
          .catch(() => { });
        await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => { });
      }
    }

    if (app) {
      await app.close();
    }
  });

  it('should request and complete a password reset with token in URL', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email })
      .expect(200);

    expect(emailSenderMock.send).toHaveBeenCalledTimes(1);

    const emailPayload = emailSenderMock.send.mock.calls[0][0] as {
      resetUrl: string;
    };
    const resetUrl = new URL(emailPayload.resetUrl);
    const token = resetUrl.searchParams.get('token');

    expect(token).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token,
        password: newPassword,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password: newPassword,
      })
      .expect(200);

    const usedTokenRows = (await prisma.$queryRaw(
      `
        SELECT used_at
        FROM shared_schema.password_reset_tokens
        WHERE email = $1
        LIMIT 1
      `,
      email,
    )) as Array<{ used_at: Date | null }>;

    expect(usedTokenRows[0]?.used_at).not.toBeNull();
  });
});
