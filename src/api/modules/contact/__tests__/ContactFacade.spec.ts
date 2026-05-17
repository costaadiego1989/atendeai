import { ContactFacade } from '../application/facades/ContactFacade';
import { IIdentifyContactUseCase } from '../application/use-cases/interfaces/IIdentifyContactUseCase';
import { IContactRepository } from '../domain/repositories/IContactRepository';
import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { ContactStageVO } from '../domain/value-objects/ContactStage';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('ContactFacade', () => {
  let facade: ContactFacade;
  let mockIdentifyUseCase: jest.Mocked<IIdentifyContactUseCase>;
  let mockRepo: jest.Mocked<IContactRepository>;

  const tenantId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    mockIdentifyUseCase = {
      execute: jest.fn(),
    } as any;

    mockRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findAllByTenant: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IContactRepository>;

    facade = new ContactFacade(mockIdentifyUseCase, mockRepo);
  });

  it('should delegate identifyContact to IdentifyContactUseCase', async () => {
    mockIdentifyUseCase.execute.mockResolvedValue({
      id: 'contact-1',
      tenantId,
      name: 'John Doe',
      phone: '5511999999999',
      stage: 'LEAD',
    });

    const result = await facade.identifyContact(
      tenantId,
      '5511999999999',
      'John Doe',
    );

    expect(mockIdentifyUseCase.execute).toHaveBeenCalledWith({
      tenantId,
      phone: '5511999999999',
      name: 'John Doe',
    });
    expect(result.contactId).toBe('contact-1');
    expect(result.stage).toBe('LEAD');
  });

  it('should delegate getContactById to repository', async () => {
    const contact = Contact.reconstitute(
      {
        tenantId: TenantId.create(tenantId),
        name: ContactName.create('John Doe'),
        phone: '5511999999999',
        email: 'john@test.com',
        document: '12345678900',
        stage: ContactStageVO.create('PROSPECT'),
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      new UniqueEntityID('contact-1'),
    );
    mockRepo.findById.mockResolvedValue(contact);

    const result = await facade.getContactById(tenantId, 'contact-1');

    expect(mockRepo.findById).toHaveBeenCalledWith(tenantId, 'contact-1');
    expect(result).not.toBeNull();
    expect(result!.contactId).toBe('contact-1');
    expect(result!.name).toBe('John Doe');
    expect(result!.phone).toBe('5511999999999');
  });

  it('should return null when contact is not found in getContactById', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await facade.getContactById(tenantId, 'non-existent');

    expect(result).toBeNull();
  });

  it('should pass parameters correctly to identifyContact', async () => {
    mockIdentifyUseCase.execute.mockResolvedValue({
      id: 'contact-2',
      tenantId,
      name: 'Jane Smith',
      phone: '5511888888888',
      stage: 'CUSTOMER',
    });

    const result = await facade.identifyContact(
      tenantId,
      '5511888888888',
      'Jane Smith',
    );

    expect(mockIdentifyUseCase.execute).toHaveBeenCalledTimes(1);
    expect(result.contactId).toBe('contact-2');
    expect(result.stage).toBe('CUSTOMER');
  });

  it('should create a new contact via ensureContact when phone does not exist', async () => {
    mockRepo.findByPhone.mockResolvedValue(null);
    mockRepo.save.mockResolvedValue(undefined);

    const result = await facade.ensureContact({
      tenantId,
      name: 'New Contact',
      phone: '5511777777777',
      tags: ['imported'],
    });

    expect(result.created).toBe(true);
    expect(result.contactId).toBeDefined();
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should return existing contact via ensureContact when phone already exists', async () => {
    const existing = Contact.reconstitute(
      {
        tenantId: TenantId.create(tenantId),
        name: ContactName.create('Existing'),
        phone: '5511777777777',
        stage: ContactStageVO.create('LEAD'),
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      new UniqueEntityID('existing-id'),
    );
    mockRepo.findByPhone.mockResolvedValue(existing);

    const result = await facade.ensureContact({
      tenantId,
      name: 'New Contact',
      phone: '5511777777777',
    });

    expect(result.created).toBe(false);
    expect(result.contactId).toBe('existing-id');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
