/**
 * Live Test App Factory
 *
 * Bootstrap do NestJS app com:
 * - AI Engine: REAL (DeepSeek) — valida respostas reais da IA
 * - Message Queue: Mock — captura jobs sem enviar WhatsApp
 * - Payment Gateway: Mock — retorna links fake
 * - Event Bus: In-memory — propaga eventos entre handlers
 * - FollowUp Service: Mock — permite trigger manual
 * - Redis: Real — chat history e session store
 * - Prisma/DB: Real — banco de teste com seed por nicho
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';

import { AppModule } from '../../../../../../app.module';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { MESSAGE_QUEUE } from '@modules/messaging/domain/ports/IMessageQueue';
import { FollowUpService } from '@modules/messaging/application/services/FollowUpService';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '@modules/payment/domain/ports/IPaymentGateway';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export interface EventTrace {
  queue: string;
  eventName?: string;
  payload: Record<string, any>;
  handlerCount: number;
}

export interface QueueTrace {
  messageId?: string;
  payload: any;
}

export interface FollowUpTrace {
  conversationId: string;
}

export interface LiveTestContext {
  app: INestApplication;
  prisma: PrismaService;
  eventTraces: EventTrace[];
  queueTraces: QueueTrace[];
  followUpTraces: FollowUpTrace[];
  inMemoryEventBus: IEventBus;
  messageQueue: { addJob: jest.Mock };
  followUpService: { cancelFollowUps: jest.Mock; scheduleFollowUps: jest.Mock };
  paymentGateway: IPaymentGateway;
}

export async function createLiveTestApp(): Promise<LiveTestContext> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error(
      'RUN_NICHE_LIVE_E2E=true requires DEEPSEEK_API_KEY. The AI engine is intentionally not mocked.',
    );
  }

  const eventTraces: EventTrace[] = [];
  const queueTraces: QueueTrace[] = [];
  const followUpTraces: FollowUpTrace[] = [];

  const subscribedHandlers = new Map<
    string,
    Array<{
      consumerName?: string;
      handle: (event: Record<string, unknown>) => Promise<void>;
    }>
  >();

  const inMemoryEventBus: IEventBus = {
    async publish<T extends IntegrationEvent>(event: T): Promise<void> {
      const handlers = subscribedHandlers.get(event.queue) || [];
      const serialized = event.toJSON() as Record<string, any>;

      eventTraces.push({
        queue: event.queue,
        eventName: serialized.eventName,
        payload: serialized.payload || serialized,
        handlerCount: handlers.length,
      });

      for (const handler of handlers) {
        await handler.handle(serialized);
      }
    },
    subscribe<T extends IntegrationEvent>(
      queue: string,
      handler: (event: T) => Promise<void>,
      options?: { consumerName?: string },
    ): void {
      const handlers = subscribedHandlers.get(queue) || [];
      handlers.push({
        consumerName: options?.consumerName,
        handle: handler as unknown as (
          event: Record<string, unknown>,
        ) => Promise<void>,
      });
      subscribedHandlers.set(queue, handlers);
    },
  };

  const quotaUseCase = {
    execute: jest.fn(async () => ({
      canProceed: true,
      used: 0,
      quota: 100000,
      status: 'ACTIVE',
    })),
  };

  const messageQueue = {
    addJob: jest.fn(async (job: any) => {
      queueTraces.push({ messageId: job.messageId, payload: job });
    }),
  };

  const followUpService = {
    cancelFollowUps: jest.fn(async () => {}),
    scheduleFollowUps: jest.fn(async (conversationId: string) => {
      followUpTraces.push({ conversationId });
    }),
  };

  const paymentGateway: IPaymentGateway = {
    createCustomer: jest.fn(async (data: any) => ({
      id: `cus-${Date.now()}`,
      name: data.name,
    })),
    getCustomer: jest.fn(async (id: string) => ({ id, name: 'Cliente E2E' })),
    createSubaccount: jest.fn(async () => ({
      id: 'sub-niche-test',
      walletId: 'wallet-niche-test',
    })),
    listSubaccounts: jest.fn(async () => []),
    createSubscription: jest.fn(async () => ({
      id: 'subscr-niche-test',
      status: 'ACTIVE',
      value: 1,
      billingType: 'PIX',
      nextDueDate: getTomorrowDate(),
    })),
    updateSubscription: jest.fn(async () => ({
      id: 'subscr-niche-test',
      status: 'ACTIVE',
      value: 1,
      billingType: 'PIX',
      nextDueDate: getTomorrowDate(),
    })),
    cancelSubscription: jest.fn(async () => ({
      id: 'subscr-niche-test',
      status: 'CANCELLED',
      value: 1,
      billingType: 'PIX',
      nextDueDate: getTomorrowDate(),
    })),
    getSubscription: jest.fn(async () => ({
      id: 'subscr-niche-test',
      status: 'ACTIVE',
      value: 1,
      billingType: 'PIX',
      nextDueDate: getTomorrowDate(),
    })),
    createPayment: jest.fn(async (data: any) => ({
      id: `pay-${Date.now()}`,
      status: 'PENDING',
      value: data.value,
      billingType: data.billingType,
      dueDate: data.dueDate,
      invoiceUrl: 'https://pay.test/niche-flow',
      externalReference: data.externalReference,
    })),
    deletePayment: jest.fn(async (id: string) => ({ id, status: 'DELETED' })),
    restorePayment: jest.fn(async (id: string) => ({ id, status: 'ACTIVE' })),
    createPaymentLink: jest.fn(async ({ name }: any) => ({
      id: `plink-${Date.now()}`,
      url: `https://pay.test/${slugify(name || 'pedido')}`,
    })),
    removePaymentLink: jest.fn(async (id: string) => ({
      id,
      status: 'DELETED',
    })),
    restorePaymentLink: jest.fn(async (id: string) => ({
      id,
      status: 'ACTIVE',
    })),
    parseWebhook: jest.fn(() => null),
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EVENT_BUS)
    .useValue(inMemoryEventBus)
    .overrideProvider(ICheckQuotaUseCase)
    .useValue(quotaUseCase)
    .overrideProvider(MESSAGE_QUEUE)
    .useValue(messageQueue)
    .overrideProvider(FollowUpService)
    .useValue(followUpService)
    .overrideProvider(IPAYMENT_GATEWAY)
    .useValue(paymentGateway)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    eventTraces,
    queueTraces,
    followUpTraces,
    inMemoryEventBus,
    messageQueue,
    followUpService,
    paymentGateway,
  };
}

function getTomorrowDate(): string {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrow.toISOString().slice(0, 10);
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
