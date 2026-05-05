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
import { SyncProspectAdsLeadsUseCase } from '../application/use-cases/SyncProspectAdsLeadsUseCase';
import { IGoogleAdsLeadSource } from '../domain/ports/IGoogleAdsLeadSource';
import { IProspectLeadCaptureRepository } from '../domain/repositories/IProspectLeadCaptureRepository';

function makeTenant() {
  const tenant = Tenant.create({
    companyName: CompanyName.create('Ads Leads Store'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Owner Ads Leads',
        email: Email.create('owner@ads-leads.test'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });
  tenant.clearEvents();
  return tenant;
}

describe('SyncProspectAdsLeadsUseCase', () => {
  let useCase: SyncProspectAdsLeadsUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let googleAdsLeadSource: jest.Mocked<IGoogleAdsLeadSource>;
  let leadCaptureRepository: jest.Mocked<IProspectLeadCaptureRepository>;

  beforeEach(() => {
    tenantRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
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
      tenantRepository,
      googleAdsLeadSource,
      leadCaptureRepository,
    );
  });

  it('should throw when tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should normalize phones and persist pulled leads', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
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
      tenantId: tenant.id.toString(),
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
