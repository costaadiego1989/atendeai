import { UpdateContactUseCase } from '../application/use-cases/UpdateContactUseCase';
import { IContactRepository } from '../domain/repositories/IContactRepository';
import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { TenantId } from '@shared/domain/TenantId';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { ContactDomainEventPublisher } from '../application/services/ContactDomainEventPublisher';

describe('UpdateContactUseCase', () => {
  let useCase: UpdateContactUseCase;
  let mockRepo: jest.Mocked<IContactRepository>;
  let publisher: jest.Mocked<ContactDomainEventPublisher>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<IContactRepository>;
    publisher = {
      publishFromAggregate: jest.fn(),
    } as any;
    useCase = new UpdateContactUseCase(mockRepo, publisher);
  });

  it('should update contact successfully', async () => {
    const contact = Contact.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: ContactName.create('Old Name'),
      phone: '11999999999',
    });
    mockRepo.findById.mockResolvedValue(contact);

    const result = await useCase.execute({
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      contactId: contact.id.toString(),
      name: 'New Name',
      email: 'new@example.com',
      tags: ['new-tag'],
    });

    expect(result.name).toBe('New Name');
    expect(result.email).toBe('new@example.com');
    expect(result.tags).toContain('new-tag');
    expect(mockRepo.save).toHaveBeenCalled();
    expect(publisher.publishFromAggregate).toHaveBeenCalledWith(contact);
  });

  it('should throw if contact not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        contactId: 'non-existent',
        name: 'New Name',
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });
});
