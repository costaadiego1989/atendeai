import { NotFoundException } from '@nestjs/common';
import { GetTenantOnboardingChecklistUseCase } from '../application/use-cases/GetTenantOnboardingChecklistUseCase';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { TenantPDFResumeRepository } from '../infrastructure/persistence/repositories/TenantPDFResumeRepository';
import { AIConfig } from '../domain/entities/AIConfig';

describe('GetTenantOnboardingChecklistUseCase', () => {
  let useCase: GetTenantOnboardingChecklistUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let pdfRepository: jest.Mocked<
    Pick<TenantPDFResumeRepository, 'listByTenant'>
  >;

  beforeEach(() => {
    tenantRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      listBranches: jest.fn().mockResolvedValue([]),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
      exists: jest.fn(),
    } as any;

    pdfRepository = {
      listByTenant: jest.fn().mockResolvedValue([]),
    };

    useCase = new GetTenantOnboardingChecklistUseCase(
      tenantRepository,
      pdfRepository as unknown as TenantPDFResumeRepository,
    );
  });

  it('throws when tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('computes checklist and ratio from tenant + PDF resumes', async () => {
    const tenant = Tenant.create({
      companyName: CompanyName.create('Clinica Teste'),
      cnpj: CNPJ.create('11.444.777/0001-61'),
      plan: Plan.create('ESSENCIAL'),
      users: [
        User.create({
          name: 'Owner',
          email: Email.create('owner@test.com'),
          phone: Phone.create('11999998888'),
          passwordHash: 'hash',
          role: Role.create('OWNER'),
        }),
      ],
    });
    tenant.updateBusinessData({
      businessType: 'CLINIC',
      description: 'Atendimento humanizado',
      services: null,
      ownerBirthDate: null,
      address: null,
      catalogUrl: null,
      operatingHours: null,
      catalogFiles: [],
      promotions: [],
    });
    tenant.clearEvents();

    tenantRepository.findById.mockResolvedValue(tenant);
    pdfRepository.listByTenant.mockResolvedValue([
      {
        id: 'pdf-1',
        tenantId: tenant.id.toValue(),
        fileName: 'catalogo.pdf',
        fileUrl: 'https://x/cat.pdf',
        checksum: null,
        summaries: ['s1'],
        status: 'READY',
        error: null,
        canSendIt: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const ai = AIConfig.create({
      systemPrompt: 'Seja objetivo com o cliente.',
      tone: 'PROFESSIONAL',
      language: 'pt-BR',
      maxTokensPerResponse: 200,
      confidenceThreshold: 0.65,
      escalationMessage: null,
      businessRules: [],
    });
    tenant.configureAI(ai);
    tenant.clearEvents();

    const result = await useCase.execute(tenant.id.toValue());

    expect(
      result.items.find((i) => i.key === 'business_profile')?.completed,
    ).toBe(true);
    expect(
      result.items.find((i) => i.key === 'catalog_or_documents')?.completed,
    ).toBe(true);
    expect(result.items.find((i) => i.key === 'ai_configured')?.completed).toBe(
      true,
    );
    expect(result.completionRatio).toBe(0.6);
  });
});
