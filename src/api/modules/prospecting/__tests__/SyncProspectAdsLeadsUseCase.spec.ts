import { NotFoundException } from '@nestjs/common';
import { ITenantFacade } from '@modules/tenant/application/facades/ITenantFacade';
import { SyncProspectAdsLeadsUseCase } from '../application/use-cases/SyncProspectAdsLeadsUseCase';
import { IGoogleAdsLeadSource } from '../domain/ports/IGoogleAdsLeadSource';
import { IProspectLeadCaptureRepository } from '../domain/repositories/IProspectLeadCaptureRepository';

const TENANT_ID = 'f0e9c8b0-4f78-4a1c-bb62-1d67ad55a111';

describe('SyncProspectAdsLeadsUseCase', () => {
  let useCase: SyncProspectAdsLeadsUseCase;
  let tenantFacade: jest.Mocked<Pick<ITenantFacade, 'tenantExists'>>;
  let googleAdsLeadSource: jest.Mocked<IGoogleAdsLeadSource>;
  let leadCaptureRepository: jest.Mocked<IProspectLeadCaptureRepository>;

  beforeEach(() => {
    tenantFacade = {
      tenantExists: jest.fn().mockResolvedValue(true),
    };
    googleAdsLeadSource = {
      pullLeads: jest.fn(),
    };
    leadCaptureRepository = {
      saveMany: jest.fn(),
      findAllByTenant: jest.fn(),
      findManyByIds: jest.fn(),
    };

    useCase = new SyncProspectAdsLeadsUseCase(
      tenantFacade as any,
      googleAdsLeadSource,
      leadCaptureRepository,
    );
  });

  it('should throw when tenant does not exist', async () => {
    tenantFacade.tenantExists.mockResolvedValue(false);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should normalize phones and persist pulled leads', async () => {
    googleAdsLeadSource.pullLeads.mockResolvedValue([
      {
        externalLeadId: 'lead-1',
        campaignName: 'Orto Abril',
        fullName: 'Ana Lead',
        phone: '(21) 99888-7766',
        email: 'ana@lead.test',
        city: 'Rio de Janeiro',
        state: 'RJ',
        submissionAt: new Date('2026-04-02T10:00:00.000Z'),
        fields: [],
      },
      {
        externalLeadId: 'lead-2',
        campaignName: 'Orto Abril',
        fullName: 'Bruno Lead',
        phone: '5511999991111',
        email: 'bruno@lead.test',
        city: 'Sao Paulo',
        state: 'SP',
        submissionAt: new Date('2026-04-02T11:00:00.000Z'),
        fields: [],
      },
    ]);

    const result = await useCase.execute({
      tenantId: TENANT_ID,
      limit: 20,
    });

    const savedLeads = leadCaptureRepository.saveMany.mock.calls[0][0];
    expect(savedLeads[0].phone).toBe('5521998887766');
    expect(savedLeads[1].phone).toBe('5511999991111');
    expect(result.syncedCount).toBe(2);
    expect(result.leads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalLeadId: 'lead-1' }),
        expect.objectContaining({ externalLeadId: 'lead-2' }),
      ]),
    );
  });
});
