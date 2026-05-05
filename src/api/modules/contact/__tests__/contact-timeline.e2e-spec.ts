import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import Redis from 'ioredis';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('Contact timeline endpoint (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let tenantId: string;
  let otherTenantId: string;
  let contactId: string;
  let otherContactId: string;
  let conversationId: string;
  let professionalId: string;
  let authCookie: string;

  const ownerEmail = 'contact-timeline-owner@test.com';
  const otherOwnerEmail = 'contact-timeline-other-owner@test.com';
  const password = 'SenhaForte123!';
  const tenantCnpj = `cnpj${Date.now()}`;
  const otherTenantCnpj = `cnpj${Date.now() + 1}`;

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
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
      .deleteMany({
        where: {
          email: {
            in: [ownerEmail, otherOwnerEmail],
          },
        },
      })
      .catch(() => {});

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Contact Timeline Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Contact Timeline Other Store',
        cnpj: otherTenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.createMany({
      data: [
        {
          tenantId,
          name: 'Contact Timeline Owner',
          email: ownerEmail,
          phone: '11966665555',
          passwordHash,
          role: 'OWNER',
        },
        {
          tenantId: otherTenantId,
          name: 'Other Owner',
          email: otherOwnerEmail,
          phone: '11966665556',
          passwordHash,
          role: 'OWNER',
        },
      ],
    });

    authCookie = await login(ownerEmail);

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Lead Timeline E2E',
        phone: '5511977776666',
        stage: 'LEAD',
        notes: 'Quer retorno rapido.',
      },
    });
    contactId = contact.id;

    const otherContact = await prisma.contact.create({
      data: {
        tenantId: otherTenantId,
        name: 'Other Tenant Lead',
        phone: '5511977776655',
        stage: 'LEAD',
      },
    });
    otherContactId = otherContact.id;

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId,
        channel: 'WHATSAPP',
        status: 'PENDING_HUMAN',
      },
    });
    conversationId = conversation.id;

    await prisma.message.create({
      data: {
        conversationId,
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: { type: 'TEXT', text: 'Oi, gostaria de comprar' },
        sentBy: 'CONTACT',
        externalId: 'timeline-e2e-1',
      },
    });

    await redis.del(`messaging:follow-up:audit:${conversationId}`);
    await redis.lpush(
      `messaging:follow-up:audit:${conversationId}`,
      JSON.stringify({
        type: 'SCHEDULED',
        conversationId,
        interval: '1h',
        timestamp: new Date('2026-01-01T12:00:00.000Z').toISOString(),
      }),
    );

    await prisma.recoveryCase.create({
      data: {
        tenantId,
        contactId,
        debtorName: 'Lead Timeline E2E',
        phone: '5511977776666',
        source: 'CRM',
        status: 'NEGOTIATING',
        chargeTitle: 'Parcela em aberto',
        amountDue: '189.90',
        paymentReference: `recovery|${tenantId}|timeline-e2e-case`,
      },
    });

    await prisma.paymentWebhookReceipt.create({
      data: {
        receiptKey: `timeline-e2e-payment-${randomUUID()}`,
        provider: 'ASAAS',
        eventType: 'PAYMENT_CONFIRMED',
        paymentId: 'pay-e2e-1',
        tenantId,
        rawReference: `recovery|${tenantId}|timeline-e2e-case`,
        payload: { payment: { id: 'pay-e2e-1' } },
        status: 'PROCESSED',
        processedAt: new Date('2026-01-01T12:15:00.000Z'),
      },
    });

    professionalId = randomUUID();
    await redis.hset(
      `scheduling:tenant:${tenantId}:professionals`,
      professionalId,
      JSON.stringify({
        id: professionalId,
        tenantId,
        name: 'Dr. Rafael',
        role: 'Consultor',
        active: true,
        createdAt: '2026-01-01T09:00:00.000Z',
      }),
    );
    await redis.hset(
      `scheduling:tenant:${tenantId}:professional:${professionalId}:availability:2026-01-03`,
      '2026-01-03__09:00__09:30',
      JSON.stringify({
        id: '2026-01-03__09:00__09:30',
        startsAt: '09:00',
        endsAt: '09:30',
        status: 'RESERVED',
        reservedAt: '2026-01-01T12:30:00.000Z',
        reservedFor: {
          contactId,
          conversationId,
          notes: 'Agendamento comercial',
        },
      }),
    );
  });

  afterAll(async () => {
    if (redis && conversationId) {
      await redis.del(`messaging:follow-up:audit:${conversationId}`).catch(() => {});
      if (tenantId && professionalId) {
        await redis
          .del(
            `scheduling:tenant:${tenantId}:professionals`,
            `scheduling:tenant:${tenantId}:professional:${professionalId}:availability:2026-01-03`,
          )
          .catch(() => {});
      }
    }

    if (prisma) {
      await prisma.paymentWebhookReceipt
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
      await prisma.recoveryCase
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
      await prisma.message
        .deleteMany({
          where: {
            conversation: {
              tenantId: {
                in: [tenantId, otherTenantId].filter(Boolean),
              },
            },
          },
        })
        .catch(() => {});
      await prisma.conversation
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
      await prisma.contact
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
      await prisma.subscription
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
      await prisma.user
        .deleteMany({
          where: {
            tenantId: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
      await prisma.tenant
        .deleteMany({
          where: {
            id: {
              in: [tenantId, otherTenantId].filter(Boolean),
            },
          },
        })
        .catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should return the contact timeline for an authenticated user from the same tenant', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/contacts/${contactId}/timeline`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(response.body.contact).toEqual(
      expect.objectContaining({
        id: contactId,
        name: 'Lead Timeline E2E',
        phone: '5511977776666',
      }),
    );
    expect(response.body.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'CONTACT_CREATED' }),
        expect.objectContaining({ type: 'HANDOFF_HUMAN' }),
        expect.objectContaining({ type: 'MESSAGE_INBOUND' }),
        expect.objectContaining({ type: 'FOLLOW_UP_SCHEDULED' }),
        expect.objectContaining({ type: 'RECOVERY_CASE_CREATED' }),
        expect.objectContaining({ type: 'PAYMENT_CONFIRMED' }),
        expect.objectContaining({ type: 'SCHEDULING_RESERVED' }),
      ]),
    );
  });

  it('should return 404 when the contact does not exist', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/contacts/${randomUUID()}/timeline`)
      .set('Cookie', [authCookie])
      .expect(404);
  });

  it('should reject cross-tenant access to timeline', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenants/${otherTenantId}/contacts/${otherContactId}/timeline`)
      .set('Cookie', [authCookie])
      .expect(401);
  });
});
