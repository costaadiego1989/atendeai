import { GenerateContactsReportUseCase } from '../application/use-cases/GenerateContactsReportUseCase';
import { IContactRepository } from '../domain/repositories/IContactRepository';
import { IContactTimelineRepository } from '../application/ports/IContactTimelineRepository';
import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { ContactStageVO } from '../domain/value-objects/ContactStage';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('GenerateContactsReportUseCase', () => {
  let useCase: GenerateContactsReportUseCase;
  let mockRepo: jest.Mocked<IContactRepository>;
  let mockTimelineRepo: jest.Mocked<IContactTimelineRepository>;

  const tenantId = '123e4567-e89b-12d3-a456-426614174000';

  const makeContact = (overrides: Partial<{ name: string; phone: string; stage: string; id: string; tags: string[] }> = {}) => {
    return Contact.reconstitute(
      {
        tenantId: TenantId.create(tenantId),
        name: ContactName.create(overrides.name ?? 'John Doe'),
        phone: overrides.phone ?? '5511999999999',
        stage: ContactStageVO.create(overrides.stage ?? 'LEAD'),
        tags: overrides.tags ?? [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
      },
      new UniqueEntityID(overrides.id ?? 'contact-1'),
    );
  };

  beforeEach(() => {
    mockRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findAllByTenant: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IContactRepository>;

    mockTimelineRepo = {
      getTimeline: jest.fn(),
    } as unknown as jest.Mocked<IContactTimelineRepository>;

    useCase = new GenerateContactsReportUseCase(mockRepo, mockTimelineRepo);
  });

  it('should generate report successfully with contacts', async () => {
    const contacts = [
      makeContact({ id: 'c1', name: 'Alice', phone: '5511111111111' }),
      makeContact({ id: 'c2', name: 'Bob', phone: '5511222222222', stage: 'CUSTOMER' }),
    ];
    mockRepo.findAllByTenant.mockResolvedValue({ data: contacts, total: 2 });
    mockTimelineRepo.getTimeline.mockResolvedValue({ contact: { id: 'c1', name: 'Alice', phone: '5511111111111', stage: 'LEAD' }, entries: [] });

    const result = await useCase.execute({ tenantId });

    expect(result.generatedAt).toBeInstanceOf(Date);
    expect(result.summary.totalContacts).toBe(2);
    expect(result.contacts).toHaveLength(2);
  });

  it('should handle empty contacts list', async () => {
    mockRepo.findAllByTenant.mockResolvedValue({ data: [], total: 0 });

    const result = await useCase.execute({ tenantId });

    expect(result.summary.totalContacts).toBe(0);
    expect(result.contacts).toHaveLength(0);
  });

  it('should enforce tenant isolation by passing tenantId to repository', async () => {
    mockRepo.findAllByTenant.mockResolvedValue({ data: [], total: 0 });

    await useCase.execute({ tenantId });

    expect(mockRepo.findAllByTenant).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ page: 1, limit: 5000 }),
    );
  });

  it('should filter contacts by stage when stages filter is provided', async () => {
    const contacts = [
      makeContact({ id: 'c1', name: 'Alice', stage: 'LEAD' }),
      makeContact({ id: 'c2', name: 'Bob', stage: 'CUSTOMER' }),
    ];
    mockRepo.findAllByTenant.mockResolvedValue({ data: contacts, total: 2 });
    mockTimelineRepo.getTimeline.mockResolvedValue(null);

    const result = await useCase.execute({ tenantId, stages: ['CUSTOMER'] });

    expect(result.summary.totalContacts).toBe(1);
    expect(result.contacts[0].name).toBe('Bob');
  });
});
