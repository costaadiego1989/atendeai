import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { SuccessResponseInterceptor } from '@shared/infrastructure/http/interceptors/SuccessResponseInterceptor';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { TENANT_REPOSITORY } from '@modules/tenant/domain/repositories/ITenantRepository';
import { PublicProposalController } from '../../presentation/controllers/PublicProposalController';
import { ProposalPublicLinkService } from '../../application/services/implementations/ProposalPublicLinkService';
import { PublicProposalService } from '../../application/services/implementations/PublicProposalService';
import {
  buildProposal,
  InMemoryProposalRepository,
} from '../proposal-test-utils';

describe('PublicProposalController', () => {
  let app: INestApplication;
  let repository: InMemoryProposalRepository;
  let publicLinks: ProposalPublicLinkService;
  const tenantRepository = {
    findById: jest.fn(async () => ({
      companyName: { value: 'Empresa Publica' },
    })),
  };

  beforeAll(async () => {
    repository = new InMemoryProposalRepository();
    publicLinks = new ProposalPublicLinkService(
      repository as any,
      {
        get: (key: string) => {
          if (key === 'APP_PUBLIC_BASE_URL') return 'https://app.test';
          if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
          return undefined;
        },
      } as any,
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [PublicProposalController],
      providers: [
        { provide: 'IProposalRepository', useValue: repository },
        { provide: ProposalPublicLinkService, useValue: publicLinks },
        {
          provide: TENANT_REPOSITORY,
          useValue: tenantRepository,
        },
        {
          provide: PublicProposalService,
          useFactory: (
            repo: InMemoryProposalRepository,
            tenants: typeof tenantRepository,
            links: ProposalPublicLinkService,
          ) =>
            new PublicProposalService(
              repo as any,
              tenants as any,
              links,
              {} as any,
              {} as any,
            ),
          inject: [
            'IProposalRepository',
            TENANT_REPOSITORY,
            ProposalPublicLinkService,
          ],
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(
      new SuccessResponseInterceptor(app.get(Reflector)),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the public proposal payload directly without nested envelope', async () => {
    const proposal = buildProposal({
      id: 'public-proposal-e2e',
    });

    repository.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/public/proposals/${token}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: proposal.id,
        branding: expect.objectContaining({
          companyName: 'Empresa Publica',
        }),
        title: proposal.title,
        description: proposal.description,
        benefits: proposal.benefits,
        totalAmount: proposal.totalAmount,
        finalAmount: proposal.totalAmount,
        approvalStatus: 'PENDING',
        items: expect.arrayContaining([
          expect.objectContaining({
            name: 'Diagnóstico inicial',
          }),
        ]),
      }),
    );

    expect(response.body.data).toBeUndefined();
  });

  it('PROP-T-050: rejects tampered tokens without exposing proposal data', async () => {
    const proposal = buildProposal({
      id: 'public-proposal-tamper',
    });

    repository.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);

    await request(app.getHttpServer())
      .get(`/api/v1/public/proposals/${token.slice(0, -2)}xx`)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.message).toContain('Proposta');
      });
  });

  it('PROP-T-051: rejects a valid token after proposal deletion', async () => {
    const proposal = buildProposal({
      id: 'public-proposal-deleted',
    });

    repository.seed(proposal);
    const { token } = await publicLinks.ensurePublicLink(proposal);
    await repository.delete(proposal.id);

    await request(app.getHttpServer())
      .get(`/api/v1/public/proposals/${token}`)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.message).toContain('Proposta');
      });
  });
});
