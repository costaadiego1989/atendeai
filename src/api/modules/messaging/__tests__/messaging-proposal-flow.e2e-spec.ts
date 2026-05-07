import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { FILE_STORAGE_SERVICE } from '@shared/domain/services/FileStorageService';
import { CONTACT_FACADE } from '@modules/contact/application/facades/ContactFacade';
import { MESSAGING_FACADE } from '@modules/messaging/application/facades/MessagingFacade';
import { CreateSplitPaymentChargeUseCase } from '@modules/sales/application/use-cases/CreateSplitPaymentChargeUseCase';
import { ProposalController } from '../../proposal/presentation/controllers/ProposalController';
import { PublicProposalController } from '../../proposal/presentation/controllers/PublicProposalController';
import { ProposalAsyncJobProcessor } from '../../proposal/infrastructure/queue/ProposalAsyncJobProcessor';
import { CreateProposalService } from '../../proposal/application/services/implementations/CreateProposalService';
import { UpdateProposalService } from '../../proposal/application/services/implementations/UpdateProposalService';
import { DeleteProposalService } from '../../proposal/application/services/implementations/DeleteProposalService';
import { GetProposalService } from '../../proposal/application/services/implementations/GetProposalService';
import { ListProposalsService } from '../../proposal/application/services/implementations/ListProposalsService';
import { ScheduleProposalDeliveryService } from '../../proposal/application/services/implementations/ScheduleProposalDeliveryService';
import { ProposalPublicLinkService } from '../../proposal/application/services/implementations/ProposalPublicLinkService';
import { PublicProposalService } from '../../proposal/application/services/implementations/PublicProposalService';
import { CreateProposalUseCase } from '../../proposal/application/use-cases/CreateProposalUseCase';
import { UpdateProposalUseCase } from '../../proposal/application/use-cases/UpdateProposalUseCase';
import { DeleteProposalUseCase } from '../../proposal/application/use-cases/DeleteProposalUseCase';
import { GetProposalUseCase } from '../../proposal/application/use-cases/GetProposalUseCase';
import { ListProposalsUseCase } from '../../proposal/application/use-cases/ListProposalsUseCase';
import { GenerateProposalPdfUseCase } from '../../proposal/application/use-cases/GenerateProposalPdfUseCase';
import { ScheduleProposalDeliveryUseCase } from '../../proposal/application/use-cases/ScheduleProposalDeliveryUseCase';
import { SendProposalToConversationUseCase } from '../../proposal/application/use-cases/SendProposalToConversationUseCase';
import { InMemoryProposalRepository, createFileStorageMock, createMessagingFacadeMock, createQueueMock } from '../../proposal/__tests__/proposal-test-utils';
import { SendProposalToConversationService } from '../../proposal/application/services/implementations/SendProposalToConversationService';

describe('Messaging Proposal Flow (e2e)', () => {
  let app: INestApplication;
  let repository: InMemoryProposalRepository;
  let proposalPublicLinkService: ProposalPublicLinkService;

  beforeAll(async () => {
    repository = new InMemoryProposalRepository();
    const storageMock = createFileStorageMock();
    const queueMock = createQueueMock();
    const messagingFacadeMock = createMessagingFacadeMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [ProposalController, PublicProposalController],
      providers: [
        { provide: 'IProposalRepository', useValue: repository },
        { provide: FILE_STORAGE_SERVICE, useValue: storageMock },
        { provide: 'BullQueue_proposal-delivery', useValue: queueMock },
        { provide: MESSAGING_FACADE, useValue: messagingFacadeMock },
        {
          provide: CONTACT_FACADE,
          useValue: {
            getContactById: jest.fn().mockResolvedValue({
              id: 'contact-e2e',
              branchId: null,
              document: '12345678909',
            }),
          },
        },
        {
          provide: CreateSplitPaymentChargeUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              id: 'payment-1',
              paymentId: 'asaas-1',
              url: 'https://pay.test/proposal-1',
              status: 'PENDING',
              dueDate: '2026-06-01',
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'APP_PUBLIC_BASE_URL') return 'https://app.test';
              if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
              return undefined;
            },
          },
        },
        {
          provide: CreateProposalService,
          useFactory: (repo: InMemoryProposalRepository) => new CreateProposalService(repo),
          inject: ['IProposalRepository'],
        },
        {
          provide: UpdateProposalService,
          useFactory: (repo: InMemoryProposalRepository) => new UpdateProposalService(repo),
          inject: ['IProposalRepository'],
        },
        {
          provide: DeleteProposalService,
          useFactory: (repo: InMemoryProposalRepository) => new DeleteProposalService(repo),
          inject: ['IProposalRepository'],
        },
        {
          provide: GetProposalService,
          useFactory: (repo: InMemoryProposalRepository) => new GetProposalService(repo),
          inject: ['IProposalRepository'],
        },
        {
          provide: ListProposalsService,
          useFactory: (repo: InMemoryProposalRepository) => new ListProposalsService(repo),
          inject: ['IProposalRepository'],
        },
        {
          provide: ScheduleProposalDeliveryService,
          useFactory: (repo: InMemoryProposalRepository, queue: ReturnType<typeof createQueueMock>) =>
            new ScheduleProposalDeliveryService(repo, queue as any),
          inject: ['IProposalRepository', 'BullQueue_proposal-delivery'],
        },
        {
          provide: CreateProposalUseCase,
          useFactory: (service: CreateProposalService) => new CreateProposalUseCase(service),
          inject: [CreateProposalService],
        },
        {
          provide: UpdateProposalUseCase,
          useFactory: (service: UpdateProposalService) => new UpdateProposalUseCase(service),
          inject: [UpdateProposalService],
        },
        {
          provide: DeleteProposalUseCase,
          useFactory: (service: DeleteProposalService) => new DeleteProposalUseCase(service),
          inject: [DeleteProposalService],
        },
        {
          provide: GetProposalUseCase,
          useFactory: (service: GetProposalService) => new GetProposalUseCase(service),
          inject: [GetProposalService],
        },
        {
          provide: ListProposalsUseCase,
          useFactory: (service: ListProposalsService) => new ListProposalsUseCase(service),
          inject: [ListProposalsService],
        },
        {
          provide: GenerateProposalPdfUseCase,
          useFactory: (repo: InMemoryProposalRepository, storage: ReturnType<typeof createFileStorageMock>) =>
            new GenerateProposalPdfUseCase(repo, storage),
          inject: ['IProposalRepository', FILE_STORAGE_SERVICE],
        },
        {
          provide: ScheduleProposalDeliveryUseCase,
          useFactory: (service: ScheduleProposalDeliveryService) =>
            new ScheduleProposalDeliveryUseCase(service),
          inject: [ScheduleProposalDeliveryService],
        },
        {
          provide: SendProposalToConversationService,
          useFactory: (
            repo: InMemoryProposalRepository,
            publicLinks: ProposalPublicLinkService,
            messagingFacade: ReturnType<typeof createMessagingFacadeMock>,
          ) =>
            new SendProposalToConversationService(
              repo,
              publicLinks,
              messagingFacade as any,
            ),
          inject: ['IProposalRepository', ProposalPublicLinkService, MESSAGING_FACADE],
        },
        {
          provide: SendProposalToConversationUseCase,
          useFactory: (service: SendProposalToConversationService) =>
            new SendProposalToConversationUseCase(service),
          inject: [SendProposalToConversationService],
        },
        {
          provide: ProposalPublicLinkService,
          useFactory: (repo: InMemoryProposalRepository, config: ConfigService) =>
            new ProposalPublicLinkService(repo, config),
          inject: ['IProposalRepository', ConfigService],
        },
        {
          provide: PublicProposalService,
          useFactory: (
            repo: InMemoryProposalRepository,
            publicLinks: ProposalPublicLinkService,
            createCharge: CreateSplitPaymentChargeUseCase,
            contacts: any,
          ) => new PublicProposalService(repo, publicLinks, createCharge, contacts),
          inject: ['IProposalRepository', ProposalPublicLinkService, CreateSplitPaymentChargeUseCase, CONTACT_FACADE],
        },
        {
          provide: ProposalAsyncJobProcessor,
          useFactory: (
            repo: InMemoryProposalRepository,
            messagingFacade: ReturnType<typeof createMessagingFacadeMock>,
            publicLinks: ProposalPublicLinkService,
          ) => new ProposalAsyncJobProcessor(repo, messagingFacade as any, publicLinks),
          inject: ['IProposalRepository', MESSAGING_FACADE, ProposalPublicLinkService],
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    proposalPublicLinkService = app.get(ProposalPublicLinkService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates a proposal, exposes its public page and accepts it with payment link generation', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/proposals')
      .send({
        tenantId: 'tenant-e2e',
        contactId: 'contact-e2e',
        userId: 'user-e2e',
        title: 'Proposta publica',
        description: 'Fluxo publico de proposta',
        items: [{ name: 'Servico', quantity: 1, unitPrice: 375 }],
      })
      .expect(201);

    const proposal = await repository.findById(createResponse.body.id);
    expect(proposal).not.toBeNull();

    const publicAccess = await proposalPublicLinkService.ensurePublicLink(proposal!);

    const publicResponse = await request(app.getHttpServer())
      .get(`/api/v1/public/proposals/${publicAccess.token}`)
      .expect(200);

    expect(publicResponse.body.data).toEqual(
      expect.objectContaining({
        title: 'Proposta publica',
        approvalStatus: 'PENDING',
      }),
    );

    const acceptResponse = await request(app.getHttpServer())
      .post(`/api/v1/public/proposals/${publicAccess.token}/accept`)
      .expect(201);

    expect(acceptResponse.body.data).toEqual(
      expect.objectContaining({
        approvalStatus: 'ACCEPTED',
        payment: expect.objectContaining({
          url: 'https://pay.test/proposal-1',
        }),
      }),
    );
  });
});
