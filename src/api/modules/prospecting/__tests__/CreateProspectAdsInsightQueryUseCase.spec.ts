import { NotFoundException } from '@nestjs/common';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { ITenantRepository } from '@modules/tenant/domain/repositories/ITenantRepository';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Role } from '@modules/tenant/domain/value-objects/Role';
import { CreateProspectAdsInsightQueryUseCase } from '../application/use-cases/CreateProspectAdsInsightQueryUseCase';
import { IProspectAdsInsightQueryRepository } from '../domain/repositories/IProspectAdsInsightQueryRepository';
import { IProspectAdsInsightResultRepository } from '../domain/repositories/IProspectAdsInsightResultRepository';
import { IGoogleAdsInsightsSource } from '../domain/ports/IGoogleAdsInsightsSource';

function makeTenant() {
  const tenant = Tenant.create({
    companyName: CompanyName.create('Ads Insight Store'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Owner Ads Insight',
        email: Email.create('owner@ads-insight.test'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });
  tenant.clearEvents();
  return tenant;
}

describe('CreateProspectAdsInsightQueryUseCase', () => {
  let useCase: CreateProspectAdsInsightQueryUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let queryRepository: jest.Mocked<IProspectAdsInsightQueryRepository>;
  let resultRepository: jest.Mocked<IProspectAdsInsightResultRepository>;
  let insightsSource: jest.Mocked<IGoogleAdsInsightsSource>;

  beforeEach(() => {
    tenantRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
      listBranches: jest.fn(),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
    };
    queryRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };
    resultRepository = {
      saveMany: jest.fn(),
      deleteByQuery: jest.fn(),
      findAllByQuery: jest.fn(),
    };
    insightsSource = {
      generateInsights: jest.fn(),
    };

    useCase = new CreateProspectAdsInsightQueryUseCase(
      tenantRepository,
      queryRepository,
      resultRepository,
      insightsSource,
    );
  });

  it('should throw when tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
        segment: 'clinicas odontologicas',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should persist a completed google ads insight query', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    insightsSource.generateInsights.mockResolvedValue([
      {
        resultType: 'DEMAND_ESTIMATE',
        title: 'Clinicas odontologicas',
        subtitle: 'Volume crescente',
        metricValue: 1200,
        score: 91,
      },
      {
        resultType: 'REGION',
        title: 'Zona Sul',
        subtitle: 'Maior afinidade',
        score: 84,
      },
    ]);

    const result = await useCase.execute({
      tenantId: tenant.id.toString(),
      segment: 'clinicas odontologicas',
      city: 'Rio de Janeiro',
      state: 'RJ',
      interest: 'clareamento',
    });

    expect(resultRepository.deleteByQuery).toHaveBeenCalledWith(
      tenant.id.toString(),
      result.id,
    );
    expect(resultRepository.saveMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Clinicas odontologicas' }),
        expect.objectContaining({ title: 'Zona Sul' }),
      ]),
    );
    expect(queryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        segment: 'clinicas odontologicas',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        tenantId: tenant.id.toString(),
        source: 'GOOGLE_ADS_AUDIENCE',
        status: 'COMPLETED',
        discoveredCount: 2,
      }),
    );
  });

  it('should mark query as failed when source throws', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    insightsSource.generateInsights.mockRejectedValue(
      new Error('OAuth failed'),
    );

    await expect(
      useCase.execute({
        tenantId: tenant.id.toString(),
        segment: 'academias premium',
      }),
    ).rejects.toThrow('OAuth failed');

    const failedSave = queryRepository.save.mock.calls.at(-1)?.[0];
    expect(failedSave).toEqual(
      expect.objectContaining({
        failureReason: 'OAuth failed',
      }),
    );
    expect(failedSave?.status.value).toBe('FAILED');
  });
});
