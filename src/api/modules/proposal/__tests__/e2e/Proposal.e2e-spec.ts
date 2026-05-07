import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { FILE_STORAGE_SERVICE } from '@shared/domain/services/FileStorageService';
import { MESSAGING_FACADE } from '@modules/messaging/application/facades/MessagingFacade';
import { ProposalController } from '../../presentation/controllers/ProposalController';
import { ProposalAsyncJobProcessor } from '../../infrastructure/queue/ProposalAsyncJobProcessor';
import { CreateProposalService } from '../../application/services/implementations/CreateProposalService';
import { UpdateProposalService } from '../../application/services/implementations/UpdateProposalService';
import { DeleteProposalService } from '../../application/services/implementations/DeleteProposalService';
import { GetProposalService } from '../../application/services/implementations/GetProposalService';
import { ListProposalsService } from '../../application/services/implementations/ListProposalsService';
import { ScheduleProposalDeliveryService } from '../../application/services/implementations/ScheduleProposalDeliveryService';
import { CreateProposalUseCase } from '../../application/use-cases/CreateProposalUseCase';
import { UpdateProposalUseCase } from '../../application/use-cases/UpdateProposalUseCase';
import { DeleteProposalUseCase } from '../../application/use-cases/DeleteProposalUseCase';
import { GetProposalUseCase } from '../../application/use-cases/GetProposalUseCase';
import { ListProposalsUseCase } from '../../application/use-cases/ListProposalsUseCase';
import { GenerateProposalPdfUseCase } from '../../application/use-cases/GenerateProposalPdfUseCase';
import { ScheduleProposalDeliveryUseCase } from '../../application/use-cases/ScheduleProposalDeliveryUseCase';
import { ProposalPublicLinkService } from '../../application/services/implementations/ProposalPublicLinkService';
import { InMemoryProposalRepository, createFileStorageMock, createMessagingFacadeMock, createQueueMock } from '../proposal-test-utils';

describe('ProposalController (e2e)', () => {
  let app: INestApplication;
  let repository: InMemoryProposalRepository;
  let storageMock: ReturnType<typeof createFileStorageMock>;
  let queueMock: ReturnType<typeof createQueueMock>;
  let messagingFacadeMock: ReturnType<typeof createMessagingFacadeMock>;
  let processor: ProposalAsyncJobProcessor;

  beforeAll(async () => {
    repository = new InMemoryProposalRepository();
    storageMock = createFileStorageMock();
    queueMock = createQueueMock();
    messagingFacadeMock = createMessagingFacadeMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [ProposalController],
      providers: [
        { provide: 'IProposalRepository', useValue: repository },
        { provide: FILE_STORAGE_SERVICE, useValue: storageMock },
        { provide: 'BullQueue_proposal-delivery', useValue: queueMock },
        { provide: MESSAGING_FACADE, useValue: messagingFacadeMock },
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
          provide: ProposalPublicLinkService,
          useFactory: (repo: InMemoryProposalRepository) =>
            new ProposalPublicLinkService(repo, {
              get: (key: string) => {
                if (key === 'APP_PUBLIC_BASE_URL') return 'https://app.test';
                if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
                return undefined;
              },
            } as any),
          inject: ['IProposalRepository'],
        },
        {
          provide: ProposalAsyncJobProcessor,
          useFactory: (
            repo: InMemoryProposalRepository,
            messagingFacade: ReturnType<typeof createMessagingFacadeMock>,
            proposalPublicLinkService: ProposalPublicLinkService,
          ) => new ProposalAsyncJobProcessor(repo, messagingFacade as any, proposalPublicLinkService),
          inject: ['IProposalRepository', MESSAGING_FACADE, ProposalPublicLinkService],
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    processor = app.get(ProposalAsyncJobProcessor);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, generates, schedules and delivers a proposal to the user contact', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/proposals')
      .send({
        tenantId: 'tenant-e2e',
        contactId: 'contact-e2e',
        userId: 'user-e2e',
        title: 'E2E Proposal',
        description: 'A proposal created in the e2e test',
        benefits: 'Better conversions',
        items: [
          { name: 'Consulting', quantity: 1, unitPrice: 1200 },
          { name: 'Setup', quantity: 1, unitPrice: 800 },
        ],
      })
      .expect(201);

    expect(createResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        id: expect.any(String),
      }),
    );

    const proposalId = createResponse.body.id as string;
    expect(storageMock.upload).toHaveBeenCalledTimes(1);

    const getResponse = await request(app.getHttpServer())
      .get(`/api/v1/proposals/${proposalId}`)
      .expect(200);

    expect(getResponse.body).toEqual(
      expect.objectContaining({
        id: proposalId,
        tenantId: 'tenant-e2e',
        contactId: 'contact-e2e',
        title: 'E2E Proposal',
        totalAmount: 2000,
      }),
    );

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/proposals')
      .query({ tenantId: 'tenant-e2e' })
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0]).toEqual(
      expect.objectContaining({
        id: proposalId,
        title: 'E2E Proposal',
      }),
    );

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/proposals/${proposalId}`)
      .send({
        title: 'E2E Proposal Updated',
        benefits: 'Updated benefits',
      })
      .expect(200);

    expect(updateResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        id: proposalId,
      }),
    );

    const pdfResponse = await request(app.getHttpServer())
      .post(`/api/v1/proposals/${proposalId}/pdf`)
      .expect(201);

    expect(pdfResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        pdfUrl: 'https://cdn.test/proposals/proposal.pdf',
      }),
    );
    expect(storageMock.upload).toHaveBeenCalledTimes(2);

    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const scheduleResponse = await request(app.getHttpServer())
      .post(`/api/v1/proposals/${proposalId}/schedule`)
      .send({ scheduledAt })
      .expect(201);

    expect(scheduleResponse.body).toEqual(
      expect.objectContaining({
        success: true,
      }),
    );
    expect(queueMock.add).toHaveBeenCalledWith(
      'send-proposal',
      { proposalId },
      expect.objectContaining({
        jobId: `send-proposal-${proposalId}`,
      }),
    );

    const queuedJob = queueMock.jobs[0];
    expect(queuedJob).toEqual(
      expect.objectContaining({
        name: 'send-proposal',
        data: { proposalId },
      }),
    );

    await processor.process({
      name: 'send-proposal',
      data: { proposalId },
    } as any);

    expect(messagingFacadeMock.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-e2e',
        contactId: 'contact-e2e',
        channel: 'WHATSAPP',
        text: expect.stringContaining('https://app.test/proposal/'),
      }),
    );

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/v1/proposals/${proposalId}`)
      .expect(200);

    expect(deleteResponse.body).toEqual({ success: true });

    await request(app.getHttpServer())
      .get(`/api/v1/proposals/${proposalId}`)
      .expect(422)
      .expect((response) => {
        expect(response.body.error.code).toBe('PROPOSAL_NOT_FOUND');
      });
  });
});
