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
import * as crypto from 'crypto';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '@modules/payment/domain/ports/IPaymentGateway';
import { GoogleCalendarOAuthService } from '../infrastructure/services/GoogleCalendarOAuthService';
import { buildSchedulingPaymentReference } from '../application/services/SchedulingPaymentReference';
import { SchedulingAsyncJobStatus } from '../application/services/SchedulingAsyncJobsService';

describe('SchedulingController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let tenantId: string;
  let authCookie: string;
  const webhookSecret = 'test-scheduling-asaas-secret';

  const ownerEmail = `scheduling-owner-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `sc${Date.now()}`;

  async function login() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies!
      .map((cookie) => cookie.split(';')[0])
      .join('; ');
  }

  async function clearSchedulingKeys(currentTenantId: string) {
    const keys = await redis.keys(`scheduling:tenant:${currentTenantId}:*`);

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  function signPayload(body: Record<string, unknown>) {
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');
  }

  async function waitFor(
    assertion: () => Promise<void>,
    attempts = 20,
    intervalMs = 300,
  ) {
    let lastError: unknown;

    for (let i = 0; i < attempts; i++) {
      try {
        await assertion();
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    throw lastError;
  }

  async function waitForReportJobCompletion(jobId: string): Promise<any> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/scheduling/jobs/${jobId}`)
        .set('Cookie', [authCookie])
        .expect(200);

      const status = response.body.status as SchedulingAsyncJobStatus;
      if (status === 'COMPLETED' || status === 'FAILED') {
        return response.body;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Timed out waiting for scheduling job ${jobId}`);
  }

  beforeAll(async () => {
    process.env.ASAAS_WEBHOOK_SECRET = webhookSecret;

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

    await prisma.$executeRaw(Prisma.sql`
      CREATE SCHEMA IF NOT EXISTS tenant_schema
    `);
    await prisma.$executeRaw(Prisma.sql`
      CREATE SCHEMA IF NOT EXISTS payment_schema
    `);
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS payment_schema.payment_webhook_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_key VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payment_id VARCHAR(100) NOT NULL,
        tenant_id UUID NULL,
        raw_reference VARCHAR(255) NULL,
        signature TEXT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
        ignore_reason VARCHAR(100) NULL,
        processed_at TIMESTAMPTZ NULL,
        ignored_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRaw(Prisma.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_receipts_receipt_key_key
      ON payment_schema.payment_webhook_receipts (receipt_key)
    `);

    await prisma.user.deleteMany({ where: { email: ownerEmail } }).catch(() => { });

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Scheduling Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    await prisma.user.create({
      data: {
        tenantId,
        name: 'Scheduling Owner',
        email: ownerEmail,
        phone: '11970000050',
        passwordHash,
        role: 'OWNER',
      },
    });

    authCookie = await login();
    await clearSchedulingKeys(tenantId);
  });

  afterAll(async () => {
    if (tenantId) {
      await clearSchedulingKeys(tenantId).catch(() => { });
      await prisma.$executeRaw(
        Prisma.sql`
          DELETE FROM scheduling_schema.scheduling_async_jobs
          WHERE tenant_id = ${tenantId}::uuid
        `,
      ).catch(() => { });
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => { });
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => { });
      await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => { });
    }

    if (app) {
      await app.close();
    }
  });

  it('should create professionals, manage daily availability and reserve a slot', async () => {
    const createProfessionalResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/professionals`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Carlos Barber',
        role: 'barbeiro',
      })
      .expect(201);

    const professionalId = createProfessionalResponse.body.id;
    expect(professionalId).toBeDefined();

    const listProfessionalsResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/scheduling/professionals`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(listProfessionalsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: professionalId,
          name: 'Carlos Barber',
          role: 'barbeiro',
        }),
      ]),
    );

    const date = '2030-06-15';

    const setAvailabilityResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slots: [
          {
            startsAt: '09:00',
            endsAt: '09:30',
            label: 'Corte rapido',
          },
          {
            startsAt: '10:00',
            endsAt: '10:30',
            label: 'Barba completa',
          },
        ],
      })
      .expect(201);

    expect(setAvailabilityResponse.body).toHaveLength(2);

    const getAvailabilityResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability?date=${date}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(getAvailabilityResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'AVAILABLE',
          startsAt: '09:00',
        }),
        expect.objectContaining({
          status: 'AVAILABLE',
          startsAt: '10:00',
        }),
      ]),
    );

    const slotId = getAvailabilityResponse.body[0].id;

    const reserveResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability/reservations`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slotId,
        contactId: randomUUID(),
        notes: 'Reserva via WhatsApp',
      })
      .expect(201);

    expect(reserveResponse.body).toEqual(
      expect.objectContaining({
        id: slotId,
        status: 'RESERVED',
        reservedFor: expect.objectContaining({
          notes: 'Reserva via WhatsApp',
        }),
      }),
    );

    const availabilityAfterReservation = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability?date=${date}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(availabilityAfterReservation.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: slotId,
          status: 'RESERVED',
        }),
        expect.objectContaining({
          startsAt: '10:00',
          status: 'AVAILABLE',
        }),
      ]),
    );

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability/reservations`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slotId,
      })
      .expect(409);
  });

  it('should reschedule an existing reservation to another available slot', async () => {
    const contactResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Cliente Remarcação',
        phone: '21991112222',
        document: '12345678901',
        email: 'cliente.remarcação@test.com',
      })
      .expect(201);

    const professionalResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/professionals`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Mariana Agenda',
        role: 'consultora',
      })
      .expect(201);

    const sourceDate = '2030-06-18';
    const targetDate = '2030-06-19';

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability`,
      )
      .set('Cookie', [authCookie])
      .send({
        date: sourceDate,
        slots: [
          {
            startsAt: '09:00',
            endsAt: '09:30',
            label: 'Consulta inicial',
          },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability`,
      )
      .set('Cookie', [authCookie])
      .send({
        date: targetDate,
        slots: [
          {
            startsAt: '11:00',
            endsAt: '11:30',
            label: 'Consulta inicial',
          },
        ],
      })
      .expect(201);

    const sourceAvailability = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability?date=${sourceDate}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    const targetAvailability = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability?date=${targetDate}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    const sourceSlotId = sourceAvailability.body[0].id;
    const targetSlotId = targetAvailability.body[0].id;

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability/reservations`,
      )
      .set('Cookie', [authCookie])
      .send({
        date: sourceDate,
        slotId: sourceSlotId,
        contactId: contactResponse.body.id,
        isFree: true,
        notes: 'Reserva para remarcar',
      })
      .expect(201);

    const rescheduleResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability/slots/${sourceSlotId}/reschedule`,
      )
      .set('Cookie', [authCookie])
      .send({
        sourceDate,
        targetDate,
        targetSlotId,
      })
      .expect(201);

    expect(rescheduleResponse.body).toEqual(
      expect.objectContaining({
        id: targetSlotId,
        status: 'RESERVED',
        startsAt: '11:00',
        reservedFor: expect.objectContaining({
          contactId: contactResponse.body.id,
          contactName: 'Cliente Remarcação',
        }),
      }),
    );

    const sourceAvailabilityAfter = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability?date=${sourceDate}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    const targetAvailabilityAfter = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability?date=${targetDate}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(sourceAvailabilityAfter.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: sourceSlotId,
          status: 'AVAILABLE',
        }),
      ]),
    );

    expect(targetAvailabilityAfter.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: targetSlotId,
          status: 'RESERVED',
          reservedFor: expect.objectContaining({
            contactId: contactResponse.body.id,
          }),
        }),
      ]),
    );
  });

  it('should manage categories and list available professionals by category', async () => {
    const categoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/categories`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Clareamento',
        unit: 'PER_MINUTE',
        durationMinutes: 60,
      })
      .expect(201);

    const categoryId = categoryResponse.body.id;
    expect(categoryId).toBeDefined();

    const categoriesResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/scheduling/categories`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(categoriesResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: categoryId,
          name: 'Clareamento',
          unit: 'PER_MINUTE',
          durationMinutes: 60,
        }),
      ]),
    );

    const firstProfessional = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/professionals`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Dra. Ana',
        role: 'dentista',
      })
      .expect(201);

    const secondProfessional = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/professionals`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Dr. Bruno',
        role: 'dentista',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${firstProfessional.body.id}/categories`,
      )
      .set('Cookie', [authCookie])
      .send({
        categoryIds: [categoryId],
      })
      .expect(201);

    const assignedProfessionalsResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/categories/${categoryId}/professionals`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(assignedProfessionalsResponse.body).toEqual([
      expect.objectContaining({
        id: firstProfessional.body.id,
        name: 'Dra. Ana',
      }),
    ]);

    const date = '2030-06-16';

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${firstProfessional.body.id}/availability`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slots: [
          {
            startsAt: '14:00',
            endsAt: '15:00',
            label: 'Clareamento',
          },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${secondProfessional.body.id}/availability`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slots: [
          {
            startsAt: '16:00',
            endsAt: '17:00',
            label: 'Consulta geral',
          },
        ],
      })
      .expect(201);

    const categoryAvailabilityResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/categories/${categoryId}/availability?date=${date}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(categoryAvailabilityResponse.body).toEqual([
      expect.objectContaining({
        professionalId: firstProfessional.body.id,
        professionalName: 'Dra. Ana',
        slots: [
          expect.objectContaining({
            startsAt: '14:00',
            status: 'AVAILABLE',
          }),
        ],
      }),
    ]);
  });

  it('should complete a scheduling flow from reservation to payment confirmation', async () => {
    const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
    jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
      id: 'plink-scheduling-e2e',
      url: 'https://pay.test/scheduling-e2e',
    });

    const contactResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Paciente Agendado',
        phone: '11988887777',
        document: '05178178700',
        email: 'paciente.agendado@test.com',
        tags: ['agenda', 'premium'],
      })
      .expect(201);

    const categoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/categories`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Consulta premium',
        unit: 'PER_CONSULTATION',
        basePrice: 180,
      })
      .expect(201);

    const professionalResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/professionals`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Dra. Helena',
        role: 'consultora',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/categories`,
      )
      .set('Cookie', [authCookie])
      .send({
        categoryIds: [categoryResponse.body.id],
      })
      .expect(201);

    const date = '2030-07-20';

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slots: [
          {
            startsAt: '19:00',
            endsAt: '20:00',
            label: 'Consulta premium noturna',
            customPrice: 230,
          },
        ],
      })
      .expect(201);

    const availabilityResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability?date=${date}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    const slotId = availabilityResponse.body[0].id;

    const reserveResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability/reservations`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slotId,
        contactId: contactResponse.body.id,
        categoryId: categoryResponse.body.id,
        isFree: false,
        paymentTimeoutHours: 3,
        notes: 'Primeira consulta confirmada',
      })
      .expect(201);

    const schedulingReference = buildSchedulingPaymentReference({
      tenantId,
      professionalId: professionalResponse.body.id,
      date,
      slotId,
    });

    expect(reserveResponse.body).toEqual(
      expect.objectContaining({
        id: slotId,
        status: 'PRE_RESERVED',
        reservedFor: expect.objectContaining({
          contactId: contactResponse.body.id,
          contactName: 'Paciente Agendado',
          categoryId: categoryResponse.body.id,
          categoryName: 'Consulta premium',
        }),
        payment: expect.objectContaining({
          reference: schedulingReference,
          linkId: 'plink-scheduling-e2e',
          linkUrl: 'https://pay.test/scheduling-e2e',
          amount: 230,
          status: 'PENDING',
        }),
      }),
    );

    const availabilityAfterLink = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability?date=${date}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(availabilityAfterLink.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: slotId,
          status: 'PRE_RESERVED',
          payment: expect.objectContaining({
            reference: schedulingReference,
            linkId: 'plink-scheduling-e2e',
            linkUrl: 'https://pay.test/scheduling-e2e',
            amount: 230,
            status: 'PENDING',
          }),
        }),
      ]),
    );

    const webhookBody = {
      event: 'PAYMENT_CONFIRMED',
      dateCreated: '2030-07-20T19:05:00.000Z',
      payment: {
        id: 'pay-scheduling-e2e',
        externalReference: schedulingReference,
        value: 230,
        confirmedDate: '2030-07-20T19:05:00.000Z',
      },
    };

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/asaas')
      .set('asaas-api-signature', signPayload(webhookBody))
      .send(webhookBody)
      .expect(200, { received: true });

    await waitFor(async () => {
      const availabilityAfterPayment = await request(app.getHttpServer())
        .get(
          `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability?date=${date}`,
        )
        .set('Cookie', [authCookie])
        .expect(200);

      expect(availabilityAfterPayment.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: slotId,
            status: 'RESERVED',
            payment: expect.objectContaining({
              reference: schedulingReference,
              status: 'PAID',
            }),
          }),
        ]),
      );
    });
  });

  it('should send the Google Meet link by WhatsApp after an online paid scheduling payment is confirmed', async () => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const paymentGateway = app.get<IPaymentGateway>(IPAYMENT_GATEWAY);
    jest.spyOn(paymentGateway, 'createPaymentLink').mockResolvedValue({
      id: `plink-scheduling-online-e2e-${uniqueSuffix}`,
      url: 'https://pay.test/scheduling-online-e2e',
    });

    const googleCalendarOAuthService = app.get(GoogleCalendarOAuthService);
    const createEventSpy = jest
      .spyOn(googleCalendarOAuthService, 'createEvent')
      .mockResolvedValue({
        id: `google-event-online-e2e-${uniqueSuffix}`,
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      });
    jest.spyOn(googleCalendarOAuthService, 'updateEvent').mockResolvedValue({
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    });

    const contactResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/contacts`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Paciente Online',
        phone: '11988886666',
        document: '12345678909',
        email: 'paciente.online@test.com',
      })
      .expect(201);

    const categoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/categories`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Teleconsulta premium',
        unit: 'PER_CONSULTATION',
        basePrice: 250,
      })
      .expect(201);

    const professionalResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/professionals`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Dra. Meet',
        role: 'telemedicina',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/categories`,
      )
      .set('Cookie', [authCookie])
      .send({
        categoryIds: [categoryResponse.body.id],
      })
      .expect(201);

    const now = new Date().toISOString();
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO scheduling_schema.google_calendar_connection_scopes (
        scope_key, tenant_id, branch_id, google_email, refresh_token, calendar_id, status, connected_at, updated_at
      ) VALUES (
        ${`${tenantId}:global`},
        ${tenantId}::uuid,
        NULL,
        ${'calendar-owner@test.com'},
        ${'refresh-token-test'},
        ${'primary'},
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

    const date = '2030-09-21';

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slots: [
          {
            startsAt: '16:00',
            endsAt: '17:00',
            label: 'Teleconsulta premium',
            customPrice: 250,
            isOnline: true,
          },
        ],
      })
      .expect(201);

    const availabilityResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability?date=${date}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    const slotId = availabilityResponse.body[0].id;

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability/reservations`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slotId,
        contactId: contactResponse.body.id,
        categoryId: categoryResponse.body.id,
        isFree: false,
        isOnline: true,
        paymentTimeoutHours: 3,
      })
      .expect(201);

    expect(createEventSpy).toHaveBeenCalledWith(
      'refresh-token-test',
      'primary',
      expect.objectContaining({
        createGoogleMeet: true,
      }),
    );

    const schedulingReference = buildSchedulingPaymentReference({
      tenantId,
      professionalId: professionalResponse.body.id,
      date,
      slotId,
    });

    const webhookBody = {
      event: 'PAYMENT_CONFIRMED',
      dateCreated: '2030-09-21T16:05:00.000Z',
      payment: {
        id: `pay-scheduling-online-e2e-${uniqueSuffix}`,
        externalReference: schedulingReference,
        value: 250,
        confirmedDate: '2030-09-21T16:05:00.000Z',
      },
    };

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/asaas')
      .set('asaas-api-signature', signPayload(webhookBody))
      .send(webhookBody)
      .expect(200, { received: true });

    await waitFor(async () => {
      const availabilityAfterPayment = await request(app.getHttpServer())
        .get(
          `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability?date=${date}`,
        )
        .set('Cookie', [authCookie])
        .expect(200);

      expect(availabilityAfterPayment.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: slotId,
            status: 'RESERVED',
            reservedFor: expect.objectContaining({
              meetingProvider: 'GOOGLE_MEET',
              meetingUrl: 'https://meet.google.com/abc-defg-hij',
            }),
            payment: expect.objectContaining({
              reference: schedulingReference,
              status: 'PAID',
            }),
          }),
        ]),
      );
    });

    await waitFor(async () => {
      const messages = await prisma.message.findMany({
        where: {
          conversation: {
            tenantId,
            contactId: contactResponse.body.id,
          },
          sentBy: 'SYSTEM',
          direction: 'OUTBOUND',
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.objectContaining({
              text: expect.stringContaining(
                'Link do Google Meet: https://meet.google.com/abc-defg-hij',
              ),
            }),
          }),
        ]),
      );
    }, 60, 500);
  });

  it('should enqueue a scheduling report job and download the csv', async () => {
    const categoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/categories`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Sessao relatorio',
        unit: 'PER_SESSION',
        basePrice: 140,
      })
      .expect(201);

    const professionalResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/professionals`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Bianca Relatorio',
        role: 'especialista',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/categories`,
      )
      .set('Cookie', [authCookie])
      .send({
        categoryIds: [categoryResponse.body.id],
      })
      .expect(201);

    const date = '2030-08-10';

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slots: [
          {
            startsAt: '15:00',
            endsAt: '15:30',
            label: 'Sessao de teste',
            customPrice: 160,
          },
        ],
      })
      .expect(201);

    const availabilityResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability?date=${date}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/scheduling/professionals/${professionalResponse.body.id}/availability/reservations`,
      )
      .set('Cookie', [authCookie])
      .send({
        date,
        slotId: availabilityResponse.body[0].id,
        contactId: randomUUID(),
        categoryId: categoryResponse.body.id,
        isFree: true,
        notes: 'Reserva para relatorio',
      })
      .expect(201);

    const startResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/scheduling/report-jobs`)
      .set('Cookie', [authCookie])
      .send({
        startDate: date,
        endDate: date,
        professionalIds: [professionalResponse.body.id],
        categoryIds: [categoryResponse.body.id],
        statuses: ['RESERVED'],
      })
      .expect(202);

    expect(startResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'EXPORT_SCHEDULING_REPORT_CSV',
        status: expect.stringMatching(/QUEUED|PROCESSING/),
      }),
    );

    const reportJob = await waitForReportJobCompletion(startResponse.body.id);
    expect(reportJob.status).toBe('COMPLETED');
    expect(reportJob.fileName).toContain('relatorio-agenda-');

    const downloadResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/scheduling/jobs/${reportJob.id}/download`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(downloadResponse.header['content-type']).toContain('text/csv');
    expect(downloadResponse.text).toContain('Bianca Relatorio');
    expect(downloadResponse.text).toContain('Reserva para relatorio');
  });
});
