// ============================================================
// proposal.e2e-new.spec.ts
// NEW e2e tests — HTTP endpoints, full flow, cross-tenant isolation
// These use the same in-memory module setup as the existing e2e suite
// to avoid any real database or network connections.
// ============================================================
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { SuccessResponseInterceptor } from '@shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import { FILE_STORAGE_SERVICE } from '@shared/domain/services/FileStorageService';
import { MESSAGING_FACADE } from '@modules/messaging/application/facades/MessagingFacade';
import { TENANT_REPOSITORY } from '@modules/tenant/domain/repositories/ITenantRepository';
import { ProposalController } from '../presentation/controllers/ProposalController';
import { PublicProposalController } from '../presentation/controllers/PublicProposalController';
import { ProposalAsyncJobProcessor } from '../infrastructure/queue/ProposalAsyncJobProcessor';
import { CreateProposalService } from '../application/services/implementations/CreateProposalService';
import { UpdateProposalService } from '../application/services/implementations/UpdateProposalService';
import { DeleteProposalService } from '../application/services/implementations/DeleteProposalService';
import { GetProposalService } from '../application/services/implementations/GetProposalService';
import { ListProposalsService } from '../application/services/implementations/ListProposalsService';
import { ScheduleProposalDeliveryService } from '../application/services/implementations/ScheduleProposalDeliveryService';
import { SendProposalToConversationService } from '../application/services/implementations/SendProposalToConversationService';
import { PublicProposalService } from '../application/services/implementations/PublicProposalService';
import { ProposalPublicLinkService } from '../application/services/implementations/ProposalPublicLinkService';
import { CreateProposalUseCase } from '../application/use-cases/CreateProposalUseCase';
import { UpdateProposalUseCase } from '../application/use-cases/UpdateProposalUseCase';
import { DeleteProposalUseCase } from '../application/use-cases/DeleteProposalUseCase';
import { GetProposalUseCase } from '../application/use-cases/GetProposalUseCase';
import { ListProposalsUseCase } from '../application/use-cases/ListProposalsUseCase';
import { GenerateProposalPdfUseCase } from '../application/use-cases/GenerateProposalPdfUseCase';
import { ScheduleProposalDeliveryUseCase } from '../application/use-cases/ScheduleProposalDeliveryUseCase';
import { SendProposalToConversationUseCase } from '../application/use-cases/SendProposalToConversationUseCase';
import {
  buildProposal,
  buildProposalItem,
  InMemoryProposalRepository,
  createFileStorageMock,
  createMessagingFacadeMock,
  createQueueMock,
} from './proposal-test-utils';

// ─────────────────────────────────────────────────────────────
// Shared module setup helpers
// ─────────────────────────────────────────────────────────────
const TEST_CONFIG = {
  get: (key: string) => {
    if (key === 'APP_PUBLIC_BASE_URL') return 'https://app.test';
    if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
    return undefined;
  },
};

function makeTenantGuard(tenantId: string) {
  return {
    canActivate: (ctx: any) => {
      ctx.switchToHttp().getRequest().user = { tenantId, id: `user-${tenantId}` };
      return true;
    },
  };
}

async function buildApp(opts: {
  tenantId: string;
  repo: InMemoryProposalRepository;
  storageMock: ReturnType<typeof createFileStorageMock>;
  queueMock: ReturnType<typeof createQueueMock>;
  messagingMock: ReturnType<typeof createMessagingFacadeMock>;
  contactsMock?: { getContactById: jest.Mock };
  splitPaymentMock?: { execute: jest.Mock };
}): Promise<INestApplication> {
  const {
    tenantId,
    repo,
    storageMock,
    queueMock,
    messagingMock,
    contactsMock = { getContactById: jest.fn().mockResolvedValue(null) },
    splitPaymentMock = { execute: jest.fn() },
  } = opts;

  const { JwtCookieGuard } = await import('@shared/infrastructure/auth/guards/JwtCookieGuard');
  const { TenantGuard } = await import('@shared/infrastructure/auth/guards/TenantGuard');

  const moduleRef = await Test.createTestingModule({
    controllers: [ProposalController, PublicProposalController],
    providers: [
      { provide: 'IProposalRepository', useValue: repo },
      { provide: FILE_STORAGE_SERVICE, useValue: storageMock },
      { provide: 'BullQueue_proposal-delivery', useValue: queueMock },
      { provide: MESSAGING_FACADE, useValue: messagingMock },
      { provide: TENANT_REPOSITORY, useValue: { findById: jest.fn(async () => ({ companyName: { value: 'E2E Company' } })) } },
      { provide: CreateProposalService, useFactory: (r: InMemoryProposalRepository) => new CreateProposalService(r), inject: ['IProposalRepository'] },
      { provide: UpdateProposalService, useFactory: (r: InMemoryProposalRepository) => new UpdateProposalService(r), inject: ['IProposalRepository'] },
      { provide: DeleteProposalService, useFactory: (r: InMemoryProposalRepository) => new DeleteProposalService(r), inject: ['IProposalRepository'] },
      { provide: GetProposalService, useFactory: (r: InMemoryProposalRepository) => new GetProposalService(r), inject: ['IProposalRepository'] },
      { provide: ListProposalsService, useFactory: (r: InMemoryProposalRepository) => new ListProposalsService(r), inject: ['IProposalRepository'] },
      { provide: ScheduleProposalDeliveryService, useFactory: (r: InMemoryProposalRepository, q: any) => new ScheduleProposalDeliveryService(r, q), inject: ['IProposalRepository', 'BullQueue_proposal-delivery'] },
      { provide: SendProposalToConversationService, useFactory: (r: InMemoryProposalRepository, l: ProposalPublicLinkService, m: any) => new SendProposalToConversationService(r as any, l, m), inject: ['IProposalRepository', ProposalPublicLinkService, MESSAGING_FACADE] },
      { provide: CreateProposalUseCase, useFactory: (s: CreateProposalService) => new CreateProposalUseCase(s), inject: [CreateProposalService] },
      { provide: UpdateProposalUseCase, useFactory: (s: UpdateProposalService) => new UpdateProposalUseCase(s), inject: [UpdateProposalService] },
      { provide: DeleteProposalUseCase, useFactory: (s: DeleteProposalService) => new DeleteProposalUseCase(s), inject: [DeleteProposalService] },
      { provide: GetProposalUseCase, useFactory: (s: GetProposalService) => new GetProposalUseCase(s), inject: [GetProposalService] },
      { provide: ListProposalsUseCase, useFactory: (s: ListProposalsService) => new ListProposalsUseCase(s), inject: [ListProposalsService] },
      { provide: GenerateProposalPdfUseCase, useFactory: (r: InMemoryProposalRepository, st: any) => new GenerateProposalPdfUseCase(r, st), inject: ['IProposalRepository', FILE_STORAGE_SERVICE] },
      { provide: ScheduleProposalDeliveryUseCase, useFactory: (s: ScheduleProposalDeliveryService) => new ScheduleProposalDeliveryUseCase(s), inject: [ScheduleProposalDeliveryService] },
      { provide: SendProposalToConversationUseCase, useFactory: (s: SendProposalToConversationService) => new SendProposalToConversationUseCase(s), inject: [SendProposalToConversationService] },
      { provide: ProposalPublicLinkService, useFactory: (r: InMemoryProposalRepository) => new ProposalPublicLinkService(r as any, TEST_CONFIG as any), inject: ['IProposalRepository'] },
      { provide: PublicProposalService, useFactory: (r: InMemoryProposalRepository, t: any, l: ProposalPublicLinkService) => new PublicProposalService(r as any, t as any, l, splitPaymentMock as any, contactsMock as any), inject: ['IProposalRepository', TENANT_REPOSITORY, ProposalPublicLinkService] },
      { provide: ProposalAsyncJobProcessor, useFactory: (r: InMemoryProposalRepository, m: any, l: ProposalPublicLinkService) => new ProposalAsyncJobProcessor(r as any, m as any, l), inject: ['IProposalRepository', MESSAGING_FACADE, ProposalPublicLinkService] },
    ],
  })
    .overrideGuard(JwtCookieGuard)
    .useValue(makeTenantGuard(tenantId))
    .overrideGuard(TenantGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new SuccessResponseInterceptor(moduleRef.get(Reflector)));
  await app.init();
  return app;
}

// ─────────────────────────────────────────────────────────────
// E2E 1: Cross-tenant data isolation (gap #47)
// ─────────────────────────────────────────────────────────────
describe('E2E: Cross-tenant data isolation', () => {
  let appA: INestApplication;
  let appB: INestApplication;
  let sharedRepo: InMemoryProposalRepository;
  let storageMock: ReturnType<typeof createFileStorageMock>;
  let proposalAId: string;

  beforeAll(async () => {
    sharedRepo = new InMemoryProposalRepository();
    storageMock = createFileStorageMock();
    const queueMock = createQueueMock();
    const messagingMock = createMessagingFacadeMock();

    // Two apps authenticated as different tenants but sharing the same repository
    appA = await buildApp({ tenantId: 'tenant-A', repo: sharedRepo, storageMock, queueMock, messagingMock });
    appB = await buildApp({ tenantId: 'tenant-B', repo: sharedRepo, storageMock, queueMock, messagingMock });

    // Create a proposal via tenant-A
    const res = await request(appA.getHttpServer())
      .post('/api/v1/proposals')
      .send({
        tenantId: 'tenant-A',
        contactId: 'contact-A',
        userId: 'user-A',
        title: 'Proposal for Tenant A',
        items: [{ name: 'Service', quantity: 1, unitPrice: 500 }],
      })
      .expect(201);
    proposalAId = res.body.id;
  });

  afterAll(async () => {
    await appA.close();
    await appB.close();
  });

  it('tenant-B GET /proposals/:id for tenant-A proposal returns 422 (not found)', async () => {
    await request(appB.getHttpServer())
      .get(`/api/v1/proposals/${proposalAId}`)
      .expect(422);
  });

  it('tenant-B PATCH /proposals/:id for tenant-A proposal returns 422', async () => {
    await request(appB.getHttpServer())
      .patch(`/api/v1/proposals/${proposalAId}`)
      .send({ title: 'Hijacked' })
      .expect(422);
  });

  it('tenant-B DELETE /proposals/:id for tenant-A proposal returns 422', async () => {
    await request(appB.getHttpServer())
      .delete(`/api/v1/proposals/${proposalAId}`)
      .expect(422);
  });

  it('tenant-B GET /proposals does not include tenant-A proposals', async () => {
    const res = await request(appB.getHttpServer())
      .get('/api/v1/proposals')
      .query({ tenantId: 'tenant-B' })
      .expect(200);

    const ids = (Array.isArray(res.body) ? res.body : res.body.data ?? []).map((p: any) => p.id);
    expect(ids).not.toContain(proposalAId);
  });

  it('tenant-A GET /proposals/:id returns 200 with correct data (own proposal)', async () => {
    const res = await request(appA.getHttpServer())
      .get(`/api/v1/proposals/${proposalAId}`)
      .expect(200);

    const data = res.body.id ? res.body : res.body.data;
    expect(data.id).toBe(proposalAId);
    expect(data.tenantId).toBe('tenant-A');
  });

  it('tenant-B POST /proposals/:id/pdf for tenant-A proposal returns 422', async () => {
    await request(appB.getHttpServer())
      .post(`/api/v1/proposals/${proposalAId}/pdf`)
      .expect(422);
  });

  it('tenant-B POST /proposals/:id/send for tenant-A proposal returns 422', async () => {
    await request(appB.getHttpServer())
      .post(`/api/v1/proposals/${proposalAId}/send`)
      .expect(422);
  });
});

// ─────────────────────────────────────────────────────────────
// E2E 2: PublicProposalController — accept and reject full HTTP flows (gaps #44, #45, #46)
// ─────────────────────────────────────────────────────────────
describe('E2E: PublicProposalController — accept / reject flows', () => {
  let app: INestApplication;
  let repo: InMemoryProposalRepository;
  let publicLinks: ProposalPublicLinkService;
  let splitPaymentMock: { execute: jest.Mock };

  const validContact = {
    contactId: 'contact-456',
    name: 'E2E Client',
    document: '98765432100',
    branchId: 'branch-e2e',
  };

  beforeAll(async () => {
    repo = new InMemoryProposalRepository();
    splitPaymentMock = {
      execute: jest.fn().mockResolvedValue({
        id: 'pay-e2e',
        paymentId: 'prov-e2e',
        url: 'https://pay.test/e2e',
        dueDate: '2026-12-31',
        status: 'ACTIVE',
      }),
    };

    const storageMock = createFileStorageMock();
    const queueMock = createQueueMock();
    const messagingMock = createMessagingFacadeMock();
    const contactsMock = { getContactById: jest.fn().mockResolvedValue(validContact) };

    app = await buildApp({
      tenantId: 'public-e2e-tenant',
      repo,
      storageMock,
      queueMock,
      messagingMock,
      contactsMock,
      splitPaymentMock,
    });

    publicLinks = new ProposalPublicLinkService(repo as any, TEST_CONFIG as any);
  });

  afterAll(() => app.close());

  it('POST /public/proposals/:token/accept with valid signature accepts the proposal', async () => {
    const proposal = buildProposal({ id: `e2e-accept-${Date.now()}`, metadata: { finalPrice: 750 } });
    repo.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/proposals/${token}/accept`)
      .send({
        signerName: 'Maria Santos',
        signatureDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      });

    expect([200, 201]).toContain(res.status);
    const body = res.body.data ?? res.body;
    expect(body.approvalStatus).toBe('ACCEPTED');
    expect(body.status).toBe('ACCEPTED');
  });

  it('POST /public/proposals/:token/accept creates a payment charge', async () => {
    const proposal = buildProposal({ id: `e2e-accept-pay-${Date.now()}`, metadata: { finalPrice: 1200 } });
    repo.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    await request(app.getHttpServer())
      .post(`/api/v1/public/proposals/${token}/accept`)
      .send({
        signerName: 'Carlos Silva',
        signatureDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      });

    expect(splitPaymentMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({ value: 1200 }),
    );
  });

  it('POST /public/proposals/:token/reject rejects the proposal and returns REJECTED status', async () => {
    const proposal = buildProposal({ id: `e2e-reject-${Date.now()}` });
    repo.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/proposals/${token}/reject`);

    expect([200, 201]).toContain(res.status);
    const body = res.body.data ?? res.body;
    expect(body.approvalStatus).toBe('REJECTED');
  });

  it('POST /public/proposals/:token/accept returns 400 when proposal already REJECTED (conflict state)', async () => {
    const proposal = buildProposal({
      id: `e2e-accept-rejected-${Date.now()}`,
      metadata: {
        commercial: {
          publicAccess: { tokenId: 'e2e-token-rej' },
          approval: { status: 'REJECTED' },
        },
      },
    });
    repo.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/proposals/${token}/accept`)
      .send({ signerName: 'Name', signatureDataUrl: 'data:image/png;base64,abc' });

    expect(res.status).toBe(400);
  });

  it('POST /public/proposals/:token/reject returns 400 when proposal already ACCEPTED (conflict state)', async () => {
    const proposal = buildProposal({
      id: `e2e-reject-accepted-${Date.now()}`,
      metadata: {
        commercial: {
          publicAccess: { tokenId: 'e2e-token-acc' },
          approval: { status: 'ACCEPTED' },
        },
      },
    });
    repo.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/public/proposals/${token}/reject`);

    expect(res.status).toBe(400);
  });

  it('GET /public/proposals/:token returns the proposal payload without a data envelope', async () => {
    const proposal = buildProposal({ id: `e2e-getpublic-${Date.now()}` });
    repo.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/public/proposals/${token}`)
      .expect(200);

    expect(res.body.id).toBe(proposal.id);
    expect(res.body.approvalStatus).toBe('PENDING');
    expect(res.body.branding.companyName).toBe('E2E Company');
  });

  it('GET /public/proposals/:token returns 404 for an invalid token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/public/proposals/completely-invalid-e2e-token')
      .expect(404);
  });
});

// ─────────────────────────────────────────────────────────────
// E2E 3: Full proposal lifecycle with async job delivery
// ─────────────────────────────────────────────────────────────
describe('E2E: Full proposal lifecycle — create, send, accept', () => {
  let app: INestApplication;
  let repo: InMemoryProposalRepository;
  let publicLinks: ProposalPublicLinkService;
  let messagingMock: ReturnType<typeof createMessagingFacadeMock>;
  let processor: ProposalAsyncJobProcessor;
  let splitPaymentMock: { execute: jest.Mock };

  const validContact = {
    contactId: 'contact-lifecycle',
    name: 'Lifecycle Client',
    document: '11122233344',
    branchId: 'branch-lifecycle',
  };

  beforeAll(async () => {
    repo = new InMemoryProposalRepository();
    messagingMock = createMessagingFacadeMock();
    splitPaymentMock = {
      execute: jest.fn().mockResolvedValue({
        id: 'pay-lifecycle',
        paymentId: 'prov-lifecycle',
        url: 'https://pay.test/lifecycle',
        dueDate: '2026-12-31',
        status: 'ACTIVE',
      }),
    };

    const storageMock = createFileStorageMock();
    const queueMock = createQueueMock();
    const contactsMock = { getContactById: jest.fn().mockResolvedValue(validContact) };

    app = await buildApp({
      tenantId: 'lifecycle-tenant',
      repo,
      storageMock,
      queueMock,
      messagingMock,
      contactsMock,
      splitPaymentMock,
    });

    publicLinks = new ProposalPublicLinkService(repo as any, TEST_CONFIG as any);
    processor = app.get(ProposalAsyncJobProcessor);
  });

  afterAll(() => app.close());

  it('complete lifecycle: create → send via HTTP → verify SENT status', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/proposals')
      .send({
        tenantId: 'lifecycle-tenant',
        contactId: 'contact-lifecycle',
        userId: 'user-lifecycle',
        title: 'Lifecycle Proposal',
        items: [{ name: 'Consulting', quantity: 2, unitPrice: 500 }],
      })
      .expect(201);

    const proposalId = createRes.body.id;
    expect(proposalId).toBeDefined();

    await request(app.getHttpServer())
      .post(`/api/v1/proposals/${proposalId}/send`)
      .expect(201);

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/proposals/${proposalId}`)
      .expect(200);

    const data = getRes.body.id ? getRes.body : getRes.body.data;
    expect(data.status).toBe('SENT');
  });

  it('complete lifecycle: create → schedule → async deliver → accept via public URL', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/proposals')
      .send({
        tenantId: 'lifecycle-tenant',
        contactId: 'contact-lifecycle',
        userId: 'user-lifecycle',
        title: 'Scheduled Lifecycle',
        items: [{ name: 'Workshop', quantity: 1, unitPrice: 2000 }],
      })
      .expect(201);

    const proposalId = createRes.body.id;

    // Schedule delivery
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    await request(app.getHttpServer())
      .post(`/api/v1/proposals/${proposalId}/schedule`)
      .send({ scheduledAt: futureDate })
      .expect(201);

    // Simulate async job processing
    await processor.process({
      name: 'send-proposal',
      data: { proposalId, tenantId: 'lifecycle-tenant' },
    } as any);

    // Verify proposal is SENT
    const storedProposal = await repo.findById(proposalId, 'lifecycle-tenant');
    expect(storedProposal?.status).toBe('SENT');

    // Get the public token and accept via public endpoint
    const { token } = await publicLinks.ensurePublicLink(storedProposal!);
    const acceptRes = await request(app.getHttpServer())
      .post(`/api/v1/public/proposals/${token}/accept`)
      .send({
        signerName: 'Final Signer',
        signatureDataUrl: 'data:image/png;base64,finalSig==',
      });

    expect([200, 201]).toContain(acceptRes.status);
    const acceptBody = acceptRes.body.data ?? acceptRes.body;
    expect(acceptBody.approvalStatus).toBe('ACCEPTED');
  });
});

// ─────────────────────────────────────────────────────────────
// E2E 4: ProposalController — additional endpoint coverage
// ─────────────────────────────────────────────────────────────
describe('E2E: ProposalController — additional endpoint scenarios', () => {
  let app: INestApplication;
  let repo: InMemoryProposalRepository;
  let storageMock: ReturnType<typeof createFileStorageMock>;

  beforeAll(async () => {
    repo = new InMemoryProposalRepository();
    storageMock = createFileStorageMock();
    const queueMock = createQueueMock();
    const messagingMock = createMessagingFacadeMock();

    app = await buildApp({
      tenantId: 'extra-tenant',
      repo,
      storageMock,
      queueMock,
      messagingMock,
    });
  });

  afterAll(() => app.close());

  it('GET /proposals returns an empty array when the tenant has no proposals', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/proposals')
      .query({ tenantId: 'empty-tenant' })
      .expect(200);

    const body = Array.isArray(res.body) ? res.body : res.body.data ?? [];
    expect(body).toHaveLength(0);
  });

  it('PATCH /proposals/:id with a zero-quantity item in items array returns error', async () => {
    const proposal = buildProposal({ tenantId: 'extra-tenant' });
    repo.seed(proposal);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/proposals/${proposal.id}`)
      .send({ items: [{ name: 'Bad', quantity: 0, unitPrice: 100 }] });

    expect([400, 422]).toContain(res.status);
  });

  it('POST /proposals/:id/pdf updates the proposal pdfUrl (end-to-end)', async () => {
    const proposal = buildProposal({ tenantId: 'extra-tenant' });
    repo.seed(proposal);
    storageMock.upload.mockResolvedValue('https://cdn.test/e2e-gen.pdf');

    const res = await request(app.getHttpServer())
      .post(`/api/v1/proposals/${proposal.id}/pdf`)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.pdfUrl).toBe('https://cdn.test/e2e-gen.pdf');

    const stored = await repo.findById(proposal.id, 'extra-tenant');
    expect(stored?.pdfUrl).toBe('https://cdn.test/e2e-gen.pdf');
  });

  it('POST /proposals with validUntil as ISO string creates proposal with correct validUntil', async () => {
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/v1/proposals')
      .send({
        tenantId: 'extra-tenant',
        contactId: 'c1',
        userId: 'u1',
        title: 'With ValidUntil',
        validUntil,
        items: [{ name: 'Item', quantity: 1, unitPrice: 100 }],
      })
      .expect(201);

    const stored = await repo.findById(res.body.id, 'extra-tenant');
    expect(stored?.validUntil).toBeDefined();
    expect(new Date(stored!.validUntil!).toISOString()).toBe(new Date(validUntil).toISOString());
  });

  it('POST /proposals/:id/schedule returns 422 when proposal does not exist', async () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    await request(app.getHttpServer())
      .post('/api/v1/proposals/nonexistent-sched/schedule')
      .send({ scheduledAt: futureDate })
      .expect(422);
  });

  it('PATCH /proposals/:id updates metadata correctly', async () => {
    const proposal = buildProposal({ tenantId: 'extra-tenant' });
    repo.seed(proposal);

    await request(app.getHttpServer())
      .patch(`/api/v1/proposals/${proposal.id}`)
      .send({ metadata: { customField: 'customValue', source: 'e2e-test' } })
      .expect(200);

    const stored = await repo.findById(proposal.id, 'extra-tenant');
    expect((stored?.metadata as any)?.customField).toBe('customValue');
  });

  it('POST /proposals with items containing zero-price item creates proposal with totalAmount = sum of non-zero items', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/proposals')
      .send({
        tenantId: 'extra-tenant',
        contactId: 'c-zero',
        userId: 'u-zero',
        title: 'Zero Price Item Test',
        items: [
          { name: 'Paid', quantity: 1, unitPrice: 1000 },
          { name: 'Free', quantity: 1, unitPrice: 0 },
        ],
      })
      .expect(201);

    const stored = await repo.findById(res.body.id, 'extra-tenant');
    expect(stored?.totalAmount).toBe(1000);
  });

  it('GET /public/proposals/:token response has no nested .data wrapper (raw proposal payload)', async () => {
    const proposal = buildProposal({ id: `e2e-raw-${Date.now()}`, tenantId: 'extra-tenant' });
    repo.seed(proposal);

    const localPublicLinks = new ProposalPublicLinkService(repo as any, TEST_CONFIG as any);
    const { token } = await localPublicLinks.ensurePublicLink(proposal);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/public/proposals/${token}`)
      .expect(200);

    // Public controller bypasses the SuccessResponseInterceptor for the proposal payload
    // based on existing test documentation
    expect(res.body.id).toBe(proposal.id);
    expect(res.body.data).toBeUndefined();
  });

  it('complete flow: create → update → delete → verify gone', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/proposals')
      .send({
        tenantId: 'extra-tenant',
        contactId: 'c-full',
        userId: 'u-full',
        title: 'Full CRUD Test',
        items: [{ name: 'Item', quantity: 1, unitPrice: 300 }],
      })
      .expect(201);

    const proposalId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/proposals/${proposalId}`)
      .send({ title: 'Updated Full CRUD' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/proposals/${proposalId}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/proposals/${proposalId}`)
      .expect(422);
  });
});
