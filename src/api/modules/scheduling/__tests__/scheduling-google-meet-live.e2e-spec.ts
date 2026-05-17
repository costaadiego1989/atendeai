import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import Redis from 'ioredis';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { GoogleCalendarOAuthService } from '../infrastructure/services/GoogleCalendarOAuthService';

const describeLiveGoogleMeet = process.env.GOOGLE_CALENDAR_TEST_REFRESH_TOKEN
  ? describe
  : describe.skip;

describeLiveGoogleMeet('Scheduling Google Meet live integration (e2e)', () => {
  jest.setTimeout(90000);

  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let tenantId: string;
  let authCookie: string;
  let professionalId: string;
  let date: string;
  let slotId: string;

  const ownerEmail = `scheduling-meet-live-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `meet${Date.now()}`;

  async function login() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);

    return response
      .get('Set-Cookie')!
      .map((cookie) => cookie.split(';')[0])
      .join('; ');
  }

  async function clearSchedulingKeys(currentTenantId: string) {
    const keys = await redis.keys(`scheduling:tenant:${currentTenantId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(REDIS_CLIENT);

    await prisma.user
      .deleteMany({ where: { email: ownerEmail } })
      .catch(() => {});

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Scheduling Meet Live',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    await prisma.user.create({
      data: {
        tenantId,
        name: 'Scheduling Meet Owner',
        email: ownerEmail,
        phone: '11970000051',
        passwordHash: await bcrypt.hash(password, 10),
        role: 'OWNER',
      },
    });

    authCookie = await login();
    await clearSchedulingKeys(tenantId);

    const now = new Date().toISOString();
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO scheduling_schema.google_calendar_connection_scopes (
        scope_key, tenant_id, branch_id, google_email, refresh_token, calendar_id, status, connected_at, updated_at
      ) VALUES (
        ${`${tenantId}:global`},
        ${tenantId}::uuid,
        NULL,
        ${process.env.GOOGLE_CALENDAR_TEST_EMAIL ?? null},
        ${process.env.GOOGLE_CALENDAR_TEST_REFRESH_TOKEN!},
        ${process.env.GOOGLE_CALENDAR_TEST_CALENDAR_ID ?? 'primary'},
        ${'CONNECTED'},
        ${now}::timestamptz,
        ${now}::timestamptz
      )
      ON CONFLICT (scope_key) DO UPDATE SET
        refresh_token = EXCLUDED.refresh_token,
        calendar_id = EXCLUDED.calendar_id,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `);
  });

  afterAll(async () => {
    if (tenantId) {
      if (professionalId && date && slotId) {
        const rows = await prisma.$queryRaw<
          Array<{ event_id: string }>
        >(Prisma.sql`
          SELECT event_id
          FROM scheduling_schema.google_calendar_event_links
          WHERE tenant_id = ${tenantId}::uuid
            AND professional_id = ${professionalId}
            AND date = ${date}::date
            AND slot_id = ${slotId}
          LIMIT 1
        `);

        const eventId = rows[0]?.event_id;
        if (eventId) {
          await app
            .get(GoogleCalendarOAuthService)
            .deleteEvent(
              process.env.GOOGLE_CALENDAR_TEST_REFRESH_TOKEN!,
              process.env.GOOGLE_CALENDAR_TEST_CALENDAR_ID ?? 'primary',
              eventId,
            )
            .catch(() => undefined);
        }
      }

      await clearSchedulingKeys(tenantId).catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM scheduling_schema.google_calendar_event_links
        WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM scheduling_schema.google_calendar_connection_scopes
        WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant
        .deleteMany({ where: { id: tenantId } })
        .catch(() => {});
    }

    await app?.close();
  });

  it('should create a real Google Meet link for an online reservation', async () => {
    const contactResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Paciente Meet Real',
        phone: '11988885555',
        document: '12345678910',
        email: 'paciente.meet.real@test.com',
      })
      .expect(201);

    const professionalResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/professionals`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Dra. Meet Real',
        role: 'telemedicina',
      })
      .expect(201);
    professionalId = professionalResponse.body.id;

    date = '2031-01-22';

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slots: [
          {
            startsAt: '16:00',
            endsAt: '17:00',
            label: 'Teleconsulta real',
            isOnline: true,
          },
        ],
      })
      .expect(201);

    const availabilityResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability?date=${date}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    slotId = availabilityResponse.body[0].id;

    const reserveResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability/reservations`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slotId,
        contactId: contactResponse.body.id,
        isFree: true,
        isOnline: true,
      })
      .expect(201);

    expect(reserveResponse.body).toEqual(
      expect.objectContaining({
        status: 'RESERVED',
        reservedFor: expect.objectContaining({
          meetingProvider: 'GOOGLE_MEET',
          meetingUrl: expect.stringMatching(/^https:\/\/meet\.google\.com\//),
        }),
      }),
    );
  });
});
