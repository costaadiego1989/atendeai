import { ChangeContactStageUseCase } from '../application/use-cases/ChangeContactStageUseCase';
import { IContactRepository } from '../domain/repositories/IContactRepository';
import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { TenantId } from '@shared/domain/TenantId';
import {
  EntityNotFoundException,
  DomainException,
} from '@shared/domain/exceptions/DomainExceptions';
import { ContactDomainEventPublisher } from '../application/services/ContactDomainEventPublisher';

describe('ChangeContactStageUseCase', () => {
  let useCase: ChangeContactStageUseCase;
  let mockRepo: jest.Mocked<IContactRepository>;
  let publisher: jest.Mocked<ContactDomainEventPublisher>;

  beforeEach(() => {
    mockRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findAllByTenant: jest.fn(),
    } as unknown as jest.Mocked<IContactRepository>;
    publisher = {
      publishFromAggregate: jest.fn(),
    } as any;
    useCase = new ChangeContactStageUseCase(mockRepo, publisher);
  });

  it('should successfully change stage and emit domain event', async () => {
    const contact = Contact.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: ContactName.create('Lead User'),
      phone: '11999999999',
    });
    contact.clearEvents();
    mockRepo.findById.mockResolvedValue(contact);

    const result = await useCase.execute({
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      contactId: contact.id.toString(),
      newStage: 'PROSPECT' as any,
    });

    expect(result.stage).toBe('PROSPECT');
    expect(contact.domainEvents.length).toBe(1);
    expect(mockRepo.save).toHaveBeenCalled();
    expect(publisher.publishFromAggregate).toHaveBeenCalledWith(contact);
  });

  it('should throw if contact not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        contactId: 'any',
        newStage: 'CUSTOMER' as any,
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });
});
