import { ImportContactsListUseCase } from '../application/use-cases/ImportContactsListUseCase';
import { IContactRepository } from '../domain/repositories/IContactRepository';
import { ContactDomainEventPublisher } from '../application/services/ContactDomainEventPublisher';
import { ContactImportParser } from '../application/services/ContactImportParser';
import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { ContactStageVO } from '../domain/value-objects/ContactStage';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('ImportContactsListUseCase', () => {
  let useCase: ImportContactsListUseCase;
  let mockRepo: jest.Mocked<IContactRepository>;
  let mockPublisher: jest.Mocked<ContactDomainEventPublisher>;
  let parser: ContactImportParser;

  const tenantId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    mockRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findAllByTenant: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IContactRepository>;

    mockPublisher = {
      publishFromAggregate: jest.fn(),
    } as any;

    parser = new ContactImportParser();

    useCase = new ImportContactsListUseCase(mockRepo, mockPublisher, parser);
  });

  it('should import valid CSV data and create contacts', async () => {
    mockRepo.findByPhone.mockResolvedValue(null);

    const rawText =
      'nome,telefone,documento,email\nJohn Doe,5511999999999,12345678900,john@test.com';

    const result = await useCase.execute({ tenantId, rawText });

    expect(result.totalRows).toBe(1);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(mockPublisher.publishFromAggregate).toHaveBeenCalledTimes(1);
  });

  it('should update duplicate contacts (by phone)', async () => {
    const existingContact = Contact.reconstitute(
      {
        tenantId: TenantId.create(tenantId),
        name: ContactName.create('Existing'),
        phone: '5511999999999',
        stage: ContactStageVO.create('LEAD'),
        tags: ['old-tag'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      new UniqueEntityID('existing-id'),
    );
    mockRepo.findByPhone.mockResolvedValue(existingContact);

    const rawText = 'nome,telefone\nJohn Updated,5511999999999';

    const result = await useCase.execute({ tenantId, rawText });

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should skip rows with invalid phone (less than 10 digits)', async () => {
    const rawText = 'nome,telefone\nJohn Doe,123';

    const result = await useCase.execute({ tenantId, rawText });

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
    expect(result.items[0].status).toBe('SKIPPED');
    expect(result.items[0].reason).toContain('Telefone');
  });

  it('should enforce tenant isolation by passing tenantId to repository', async () => {
    mockRepo.findByPhone.mockResolvedValue(null);

    const rawText = 'nome,telefone\nJohn Doe,5511999999999';

    await useCase.execute({ tenantId, rawText });

    expect(mockRepo.findByPhone).toHaveBeenCalledWith(
      tenantId,
      '5511999999999',
    );
  });

  it('should publish events for each created contact', async () => {
    mockRepo.findByPhone.mockResolvedValue(null);

    const rawText = 'nome,telefone\nJohn,5511999999999\nJane,5511888888888';

    await useCase.execute({ tenantId, rawText });

    expect(mockPublisher.publishFromAggregate).toHaveBeenCalledTimes(2);
  });

  it('should return import summary with created, updated, skipped, and failed counts', async () => {
    mockRepo.findByPhone
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const rawText =
      'nome,telefone\nJohn,5511999999999\nBad,123\nJane,5511888888888';

    const result = await useCase.execute({ tenantId, rawText });

    expect(result.totalRows).toBe(3);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(2);
    expect(result.items).toHaveLength(3);
  });
});
