import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  CONTACT_TIMELINE_REPOSITORY,
  IContactTimelineRepository,
} from '../application/ports/IContactTimelineRepository';
import {
  REDIS_CLIENT,
} from '@shared/infrastructure/redis/RedisModule';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

describe('PrismaContactTimelineRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let repository: IContactTimelineRepository;
  let tenantId: string;
  let contactId: string;
  let conversationId: string;
  let professionalId: string;
  const testCnpj = `cnpj${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get(REDIS_CLIENT);
    repository = app.get<IContactTimelineRepository>(CONTACT_TIMELINE_REPOSITORY);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Timeline Integration Store',
        cnpj: testCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Lead Timeline',
        phone: '5511988887777',
        email: 'lead-timeline@test.com',
        stage: 'OPPORTUNITY',
        tags: ['VIP'],
        notes: 'Cliente pediu proposta comercial.',
      },
    });
    contactId = contact.id;

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId,
        channel: 'WHATSAPP',
        status: 'PENDING_HUMAN',
        startedAt: new Date('2026-01-01T10:00:00.000Z'),
      },
    });
    conversationId = conversation.id;

    await prisma.message.createMany({
      data: [
        {
          conversationId,
          direction: 'INBOUND',
          contentType: 'TEXT',
          content: { type: 'TEXT', text: 'Quero saber o valor' },
          sentBy: 'CONTACT',
          externalId: 'ext-in-1',
          createdAt: new Date('2026-01-01T10:05:00.000Z'),
        },
        {
          conversationId,
          direction: 'OUTBOUND',
          contentType: 'TEXT',
          content: { type: 'TEXT', text: 'Vou te enviar a proposta' },
          sentBy: 'AI',
          externalId: 'ext-out-1',
          createdAt: new Date('2026-01-01T10:06:00.000Z'),
        },
      ],
    });

    await redis.del(`messaging:follow-up:audit:${conversationId}`);
    await redis.lpush(
      `messaging:follow-up:audit:${conversationId}`,
      JSON.stringify({
        type: 'TRIGGERED',
        conversationId,
        interval: '12h',
        timestamp: '2026-01-01T12:00:00.000Z',
      }),
    );
    await redis.lpush(
      `messaging:follow-up:audit:${conversationId}`,
      JSON.stringify({
        type: 'SCHEDULED',
        conversationId,
        interval: '1h',
        timestamp: '2026-01-01T10:07:00.000Z',
      }),
    );

    await prisma.recoveryCase.create({
      data: {
        tenantId,
        contactId,
        debtorName: 'Lead Timeline',
        phone: '5511988887777',
        source: 'CRM',
        status: 'PROMISE_TO_PAY',
        chargeTitle: 'Mensalidade de janeiro',
        amountDue: '249.90',
        paymentReference: `recovery|${tenantId}|timeline-case`,
        paidAt: new Date('2026-01-01T13:30:00.000Z'),
      },
    });

    await prisma.paymentWebhookReceipt.create({
      data: {
        receiptKey: `timeline-payment-${randomUUID()}`,
        provider: 'ASAAS',
        eventType: 'PAYMENT_CONFIRMED',
        paymentId: 'pay_timeline_1',
        tenantId,
        rawReference: `recovery|${tenantId}|timeline-case`,
        payload: {
          payment: {
            id: 'pay_timeline_1',
          },
        },
        status: 'PROCESSED',
        processedAt: new Date('2026-01-01T13:31:00.000Z'),
      },
    });

    professionalId = randomUUID();
    await redis.hset(
      `scheduling:tenant:${tenantId}:professionals`,
      professionalId,
      JSON.stringify({
        id: professionalId,
        tenantId,
        name: 'Dra. Camila',
        role: 'Especialista',
        active: true,
        createdAt: '2026-01-01T08:00:00.000Z',
      }),
    );
    await redis.hset(
      `scheduling:tenant:${tenantId}:professional:${professionalId}:availability:2026-01-02`,
      '2026-01-02__14:00__14:30',
      JSON.stringify({
        id: '2026-01-02__14:00__14:30',
        startsAt: '14:00',
        endsAt: '14:30',
        status: 'RESERVED',
        reservedAt: '2026-01-01T14:00:00.000Z',
        reservedFor: {
          contactId,
          conversationId,
          notes: 'Retorno para apresentar proposta',
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
            `scheduling:tenant:${tenantId}:professional:${professionalId}:availability:2026-01-02`,
          )
          .catch(() => {});
      }
    }

    if (prisma && tenantId) {
      await prisma.paymentWebhookReceipt
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.recoveryCase
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.message
        .deleteMany({ where: { conversation: { tenantId } } })
        .catch(() => {});
      await prisma.conversation
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.contact.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should build a sorted commercial timeline from Prisma and Redis sources', async () => {
    const result = await repository.getTimeline(tenantId, contactId);

    expect(result).not.toBeNull();
    expect(result?.contact).toEqual({
      id: contactId,
      name: 'Lead Timeline',
      phone: '5511988887777',
      stage: 'OPPORTUNITY',
    });

    const types = result!.entries.map((entry) => entry.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'CONTACT_CREATED',
        'CONTACT_STAGE',
        'CONTACT_NOTE',
        'RECOVERY_CASE_CREATED',
        'RECOVERY_STATUS',
        'CONVERSATION_STARTED',
        'HANDOFF_HUMAN',
        'MESSAGE_INBOUND',
        'MESSAGE_OUTBOUND',
        'PAYMENT_CONFIRMED',
        'SCHEDULING_RESERVED',
        'FOLLOW_UP_SCHEDULED',
        'FOLLOW_UP_TRIGGERED',
      ]),
    );

    const timestamps = result!.entries.map((entry) => entry.timestamp.getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));

    const handoffEntry = result!.entries.find((entry) => entry.type === 'HANDOFF_HUMAN');
    expect(handoffEntry?.details).toEqual(
      expect.objectContaining({
        conversationId,
        status: 'PENDING_HUMAN',
      }),
    );

    const followUpEntry = result!.entries.find(
      (entry) => entry.type === 'FOLLOW_UP_TRIGGERED',
    );
    expect(followUpEntry?.details).toEqual(
      expect.objectContaining({
        conversationId,
        interval: '12h',
      }),
    );

    const paymentEntry = result!.entries.find(
      (entry) => entry.type === 'PAYMENT_CONFIRMED',
    );
    expect(paymentEntry?.details).toEqual(
      expect.objectContaining({
        paymentId: 'pay_timeline_1',
        paymentReference: `recovery|${tenantId}|timeline-case`,
      }),
    );

    const schedulingEntry = result!.entries.find(
      (entry) => entry.type === 'SCHEDULING_RESERVED',
    );
    expect(schedulingEntry?.details).toEqual(
      expect.objectContaining({
        professionalId,
        professionalName: 'Dra. Camila',
        date: '2026-01-02',
        startsAt: '14:00',
      }),
    );
  });

  it('should return null when the contact does not exist for the tenant', async () => {
    const result = await repository.getTimeline(tenantId, randomUUID());

    expect(result).toBeNull();
  });
});
