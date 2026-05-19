import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PlatformDashboardController } from '../presentation/controllers/PlatformDashboardController';
import { PlatformBillingController } from '../presentation/controllers/PlatformBillingController';
import { PlatformMessagingController } from '../presentation/controllers/PlatformMessagingController';
import { PlatformSalesController } from '../presentation/controllers/PlatformSalesController';
import { PlatformCommerceController } from '../presentation/controllers/PlatformCommerceController';
import { PlatformRecoveryController } from '../presentation/controllers/PlatformRecoveryController';
import { PlatformContactsController } from '../presentation/controllers/PlatformContactsController';
import { PlatformAIController } from '../presentation/controllers/PlatformAIController';
import { PlatformAdminApiKeyGuard } from '../presentation/guards/PlatformAdminApiKeyGuard';
import { GetPlatformDashboardOverviewUseCase } from '../application/use-cases/metrics/GetPlatformDashboardOverviewUseCase';
import { GetPlatformBillingMetricsUseCase } from '../application/use-cases/metrics/GetPlatformBillingMetricsUseCase';
import { ListPlatformSubscriptionsUseCase } from '../application/use-cases/metrics/ListPlatformSubscriptionsUseCase';
import { ListPlatformUsageUseCase } from '../application/use-cases/metrics/ListPlatformUsageUseCase';
import { GetPlatformMessagingMetricsUseCase } from '../application/use-cases/metrics/GetPlatformMessagingMetricsUseCase';
import { ListPlatformConversationsUseCase } from '../application/use-cases/metrics/ListPlatformConversationsUseCase';
import { GetPlatformSalesMetricsUseCase } from '../application/use-cases/metrics/GetPlatformSalesMetricsUseCase';
import { ListPlatformPaymentLinksUseCase } from '../application/use-cases/metrics/ListPlatformPaymentLinksUseCase';
import { GetPlatformCommerceMetricsUseCase } from '../application/use-cases/metrics/GetPlatformCommerceMetricsUseCase';
import {
  GetPlatformRecoveryMetricsUseCase,
  ListPlatformRecoveryCasesUseCase,
} from '../application/use-cases/metrics/GetPlatformRecoveryMetricsUseCase';
import {
  GetPlatformContactsMetricsUseCase,
  ListPlatformContactsUseCase,
} from '../application/use-cases/metrics/GetPlatformContactsMetricsUseCase';
import {
  GetPlatformAIMetricsUseCase,
  ListPlatformAISessionsUseCase,
} from '../application/use-cases/metrics/GetPlatformAIMetricsUseCase';

describe('Platform Metrics Controllers (e2e)', () => {
  let app: INestApplication;
  const config = { get: jest.fn() };
  const dashboardOverview = { execute: jest.fn() };
  const billingMetrics = { execute: jest.fn() };
  const listSubscriptions = { execute: jest.fn() };
  const listUsage = { execute: jest.fn() };
  const messagingMetrics = { execute: jest.fn() };
  const listConversations = { execute: jest.fn() };
  const salesMetrics = { execute: jest.fn() };
  const listPaymentLinks = { execute: jest.fn() };
  const commerceMetrics = { execute: jest.fn() };
  const recoveryMetrics = { execute: jest.fn() };
  const listRecoveryCases = { execute: jest.fn() };
  const contactsMetrics = { execute: jest.fn() };
  const listContacts = { execute: jest.fn() };
  const aiMetrics = { execute: jest.fn() };
  const listAISessions = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        PlatformDashboardController,
        PlatformBillingController,
        PlatformMessagingController,
        PlatformSalesController,
        PlatformCommerceController,
        PlatformRecoveryController,
        PlatformContactsController,
        PlatformAIController,
      ],
      providers: [
        PlatformAdminApiKeyGuard,
        { provide: ConfigService, useValue: config },
        { provide: GetPlatformDashboardOverviewUseCase, useValue: dashboardOverview },
        { provide: GetPlatformBillingMetricsUseCase, useValue: billingMetrics },
        { provide: ListPlatformSubscriptionsUseCase, useValue: listSubscriptions },
        { provide: ListPlatformUsageUseCase, useValue: listUsage },
        { provide: GetPlatformMessagingMetricsUseCase, useValue: messagingMetrics },
        { provide: ListPlatformConversationsUseCase, useValue: listConversations },
        { provide: GetPlatformSalesMetricsUseCase, useValue: salesMetrics },
        { provide: ListPlatformPaymentLinksUseCase, useValue: listPaymentLinks },
        { provide: GetPlatformCommerceMetricsUseCase, useValue: commerceMetrics },
        { provide: GetPlatformRecoveryMetricsUseCase, useValue: recoveryMetrics },
        { provide: ListPlatformRecoveryCasesUseCase, useValue: listRecoveryCases },
        { provide: GetPlatformContactsMetricsUseCase, useValue: contactsMetrics },
        { provide: ListPlatformContactsUseCase, useValue: listContacts },
        { provide: GetPlatformAIMetricsUseCase, useValue: aiMetrics },
        { provide: ListPlatformAISessionsUseCase, useValue: listAISessions },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue('platform-secret');
  });

  afterAll(async () => {
    await app.close();
  });

  const HEADERS = { 'x-platform-admin-key': 'platform-secret' };

  describe('GET /platform/dashboard/overview', () => {
    it('returns 200 with valid key', async () => {
      dashboardOverview.execute.mockResolvedValue({ tenants: {}, revenue: {} });
      await request(app.getHttpServer())
        .get('/api/v1/platform/dashboard/overview?period=30d')
        .set(HEADERS)
        .expect(200);
      expect(dashboardOverview.execute).toHaveBeenCalledWith(
        expect.objectContaining({ period: '30d' }),
      );
    });

    it('rejects invalid period', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/platform/dashboard/overview?period=invalid')
        .set(HEADERS)
        .expect(400);
    });
  });

  describe('GET /platform/billing/metrics', () => {
    it('returns 200 with metrics', async () => {
      billingMetrics.execute.mockResolvedValue({ mrr: 1000 });
      await request(app.getHttpServer())
        .get('/api/v1/platform/billing/metrics')
        .set(HEADERS)
        .expect(200);
      expect(billingMetrics.execute).toHaveBeenCalled();
    });
  });

  describe('GET /platform/billing/subscriptions', () => {
    it('returns paginated subscriptions', async () => {
      listSubscriptions.execute.mockResolvedValue({ items: [], total: 0 });
      await request(app.getHttpServer())
        .get('/api/v1/platform/billing/subscriptions?page=1&limit=10')
        .set(HEADERS)
        .expect(200);
      expect(listSubscriptions.execute).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 10 }),
      );
    });
  });

  describe('GET /platform/messaging/metrics', () => {
    it('returns messaging metrics', async () => {
      messagingMetrics.execute.mockResolvedValue({ totalActiveConversations: 5 });
      await request(app.getHttpServer())
        .get('/api/v1/platform/messaging/metrics')
        .set(HEADERS)
        .expect(200);
      expect(messagingMetrics.execute).toHaveBeenCalled();
    });
  });

  describe('GET /platform/messaging/conversations', () => {
    it('returns paginated conversations with filters', async () => {
      listConversations.execute.mockResolvedValue({ items: [], total: 0 });
      await request(app.getHttpServer())
        .get('/api/v1/platform/messaging/conversations?channel=WHATSAPP&status=ACTIVE')
        .set(HEADERS)
        .expect(200);
      expect(listConversations.execute).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'WHATSAPP', status: 'ACTIVE' }),
      );
    });
  });

  describe('GET /platform/sales/metrics', () => {
    it('returns sales metrics', async () => {
      salesMetrics.execute.mockResolvedValue({ gmvTotal: 50000 });
      await request(app.getHttpServer())
        .get('/api/v1/platform/sales/metrics')
        .set(HEADERS)
        .expect(200);
    });
  });

  describe('GET /platform/commerce/metrics', () => {
    it('returns commerce metrics', async () => {
      commerceMetrics.execute.mockResolvedValue({ sessionsStarted: 100 });
      await request(app.getHttpServer())
        .get('/api/v1/platform/commerce/metrics')
        .set(HEADERS)
        .expect(200);
    });
  });

  describe('GET /platform/recovery/metrics', () => {
    it('returns recovery metrics', async () => {
      recoveryMetrics.execute.mockResolvedValue({ totalActiveCases: 10 });
      await request(app.getHttpServer())
        .get('/api/v1/platform/recovery/metrics')
        .set(HEADERS)
        .expect(200);
    });
  });

  describe('GET /platform/contacts/metrics', () => {
    it('returns contacts metrics', async () => {
      contactsMetrics.execute.mockResolvedValue({ totalContacts: 500 });
      await request(app.getHttpServer())
        .get('/api/v1/platform/contacts/metrics')
        .set(HEADERS)
        .expect(200);
    });
  });

  describe('GET /platform/ai/metrics', () => {
    it('returns AI metrics', async () => {
      aiMetrics.execute.mockResolvedValue({ totalSessions: 200 });
      await request(app.getHttpServer())
        .get('/api/v1/platform/ai/metrics')
        .set(HEADERS)
        .expect(200);
    });
  });

  describe('Auth guard', () => {
    it('rejects all endpoints without valid key', async () => {
      const endpoints = [
        '/api/v1/platform/dashboard/overview',
        '/api/v1/platform/billing/metrics',
        '/api/v1/platform/messaging/metrics',
        '/api/v1/platform/sales/metrics',
        '/api/v1/platform/commerce/metrics',
        '/api/v1/platform/recovery/metrics',
        '/api/v1/platform/contacts/metrics',
        '/api/v1/platform/ai/metrics',
      ];
      for (const endpoint of endpoints) {
        await request(app.getHttpServer()).get(endpoint).expect(401);
      }
    });
  });
});
