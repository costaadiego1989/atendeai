import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PlatformTenantsController } from '../presentation/controllers/PlatformTenantsController';
import { PlatformAdminApiKeyGuard } from '../presentation/guards/PlatformAdminApiKeyGuard';
import { ListPlatformTenantsOverviewUseCase } from '../application/use-cases/ListPlatformTenantsOverviewUseCase';
import { AdjustTenantSubscriptionQuotasUseCase } from '../application/use-cases/AdjustTenantSubscriptionQuotasUseCase';
import { DraftTenantAdminMessageUseCase } from '../application/use-cases/DraftTenantAdminMessageUseCase';
import { SendTenantManualWhatsAppUseCase } from '../application/use-cases/SendTenantManualWhatsAppUseCase';

describe('PlatformTenantsController (e2e)', () => {
  let app: INestApplication;
  const config = { get: jest.fn() };
  const listOverview = { execute: jest.fn() };
  const adjustQuotas = { execute: jest.fn() };
  const draftMessage = { execute: jest.fn() };
  const sendManual = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformTenantsController],
      providers: [
        PlatformAdminApiKeyGuard,
        { provide: ConfigService, useValue: config },
        { provide: ListPlatformTenantsOverviewUseCase, useValue: listOverview },
        {
          provide: AdjustTenantSubscriptionQuotasUseCase,
          useValue: adjustQuotas,
        },
        { provide: DraftTenantAdminMessageUseCase, useValue: draftMessage },
        { provide: SendTenantManualWhatsAppUseCase, useValue: sendManual },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue('platform-secret');
    listOverview.execute.mockResolvedValue({
      items: [{ tenantId: 'tenant-1', companyName: 'Tenant 1' }],
      page: 1,
      limit: 20,
      total: 1,
    });
    adjustQuotas.execute.mockResolvedValue({
      tenantId: 'tenant-1',
      quotas: { messages: 100, aiTokens: 2000 },
    });
    draftMessage.execute.mockResolvedValue({
      text: 'Mensagem sugerida',
    });
    sendManual.execute.mockResolvedValue({
      queued: true,
      tenantId: 'tenant-1',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('PADM-T-010: rejects missing or invalid platform key', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/tenants')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/platform/tenants')
      .set('x-platform-admin-key', 'wrong')
      .expect(401);

    expect(listOverview.execute).not.toHaveBeenCalled();
  });

  it('PADM-T-020: lists tenants only with valid platform key and transformed query', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/tenants?page=2&limit=10')
      .set('x-platform-admin-key', 'platform-secret')
      .expect(200);

    expect(listOverview.execute).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
    });
  });

  it('PADM-T-011: rejects invalid pagination contract before use case', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/tenants?page=0&limit=101')
      .set('x-platform-admin-key', 'platform-secret')
      .expect(400);

    expect(listOverview.execute).not.toHaveBeenCalled();
  });

  it('PADM-T-030: routes admin actions to explicit tenant target', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/platform/tenants/tenant-1/quotas')
      .set('x-platform-admin-key', 'platform-secret')
      .send({ messages: 100, aiTokens: 2000 })
      .expect(200);

    expect(adjustQuotas.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      messages: 100,
      aiTokens: 2000,
      contacts: undefined,
    });

    await request(app.getHttpServer())
      .post('/api/v1/platform/tenants/tenant-1/messages/draft')
      .set('x-platform-admin-key', 'platform-secret')
      .send({
        intent: 'CUSTOM',
        tenantSummary: 'Cliente precisa de aviso operacional',
        operatorHint: 'Tom cordial',
      })
      .expect(201);

    expect(draftMessage.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'CUSTOM',
        locale: 'pt-BR',
        tenantSummary: expect.stringContaining('tenantId=tenant-1'),
      }),
    );

    await request(app.getHttpServer())
      .post('/api/v1/platform/tenants/tenant-1/messages/send')
      .set('x-platform-admin-key', 'platform-secret')
      .send({ text: 'Mensagem manual' })
      .expect(201);

    expect(sendManual.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      text: 'Mensagem manual',
    });
  });
});
