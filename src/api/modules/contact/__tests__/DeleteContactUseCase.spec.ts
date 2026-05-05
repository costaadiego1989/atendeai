import { DeleteContactUseCase } from '../application/use-cases/DeleteContactUseCase';
import { IContactRepository } from '../domain/repositories/IContactRepository';
import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { TenantId } from '@shared/domain/TenantId';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { ContactDeletedIntegrationEvent } from '../application/integration-events/ContactIntegrationEvents';

describe('DeleteContactUseCase', () => {
  let useCase: DeleteContactUseCase;
  let mockRepo: jest.Mocked<IContactRepository>;
  let eventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IContactRepository>;
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    } as any;
    useCase = new DeleteContactUseCase(mockRepo, eventBus);
  });

  it('should delete contact successfully', async () => {
    const contact = Contact.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: ContactName.create('To Delete'),
      phone: '11999999999',
    });
    mockRepo.findById.mockResolvedValue(contact);

    await useCase.execute({
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      contactId: contact.id.toString(),
    });

    expect(mockRepo.delete).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174000',
      contact.id.toString(),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(ContactDeletedIntegrationEvent),
    );
  });

  it('should throw if contact not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        contactId: 'non-existent',
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });
});
