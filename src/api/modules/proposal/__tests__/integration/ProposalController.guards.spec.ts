/**
 * T4-B: ProposalController guard tests
 * Verifies all /proposals endpoints require JwtCookieGuard.
 * PublicProposalController (/public/proposals) is intentionally unauthenticated — NOT tested here.
 * Written BEFORE adding guards (TDD: red → green).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { ProposalController } from '../../presentation/controllers/ProposalController';
import { CreateProposalUseCase } from '../../application/use-cases/CreateProposalUseCase';
import { UpdateProposalUseCase } from '../../application/use-cases/UpdateProposalUseCase';
import { DeleteProposalUseCase } from '../../application/use-cases/DeleteProposalUseCase';
import { GetProposalUseCase } from '../../application/use-cases/GetProposalUseCase';
import { ListProposalsUseCase } from '../../application/use-cases/ListProposalsUseCase';
import { GenerateProposalPdfUseCase } from '../../application/use-cases/GenerateProposalPdfUseCase';
import { ScheduleProposalDeliveryUseCase } from '../../application/use-cases/ScheduleProposalDeliveryUseCase';
import { SendProposalToConversationUseCase } from '../../application/use-cases/SendProposalToConversationUseCase';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Reflector } from '@nestjs/core';

const rejectingJwtGuard = {
  canActivate: jest.fn().mockImplementation(() => {
    throw new UnauthorizedException('Access token not provided');
  }),
};

describe('ProposalController – T4-B guard enforcement', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProposalController],
      providers: [
        { provide: CreateProposalUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateProposalUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteProposalUseCase, useValue: { execute: jest.fn() } },
        { provide: GetProposalUseCase, useValue: { execute: jest.fn() } },
        { provide: ListProposalsUseCase, useValue: { execute: jest.fn().mockResolvedValue([]) } },
        { provide: GenerateProposalPdfUseCase, useValue: { execute: jest.fn() } },
        { provide: ScheduleProposalDeliveryUseCase, useValue: { execute: jest.fn() } },
        { provide: SendProposalToConversationUseCase, useValue: { execute: jest.fn() } },
        Reflector,
      ],
    })
      .overrideGuard(JwtCookieGuard)
      .useValue(rejectingJwtGuard)
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    rejectingJwtGuard.canActivate.mockImplementation(() => {
      throw new UnauthorizedException('Access token not provided');
    });
  });

  it('POST /api/v1/proposals → 401 without auth', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/proposals')
      .send({})
      .expect(401);
  });

  it('GET /api/v1/proposals → 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/proposals')
      .expect(401);
  });

  it('GET /api/v1/proposals/:id → 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/proposals/proposal-123')
      .expect(401);
  });

  it('PATCH /api/v1/proposals/:id → 401 without auth', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/proposals/proposal-123')
      .send({})
      .expect(401);
  });

  it('DELETE /api/v1/proposals/:id → 401 without auth', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/proposals/proposal-123')
      .expect(401);
  });

  it('POST /api/v1/proposals/:id/pdf → 401 without auth', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/proposals/proposal-123/pdf')
      .expect(401);
  });

  it('POST /api/v1/proposals/:id/schedule → 401 without auth', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/proposals/proposal-123/schedule')
      .send({})
      .expect(401);
  });

  it('POST /api/v1/proposals/:id/send → 401 without auth', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/proposals/proposal-123/send')
      .send({})
      .expect(401);
  });
});
