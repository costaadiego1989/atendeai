import { GetContactUseCase } from '../application/use-cases/GetContactUseCase';
import { IContactRepository } from '../domain/repositories/IContactRepository';
import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { TenantId } from '@shared/domain/TenantId';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';

describe('GetContactUseCase', () => {
  let useCase: GetContactUseCase;
  let mockRepo: jest.Mocked<IContactRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<IContactRepository>;
    useCase = new GetContactUseCase(mockRepo);
  });

  it('should return contact details if found', async () => {
    const contact = Contact.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: ContactName.create('John Doe'),
      phone: '11999999999',
      email: 'john@example.com',
    });
    mockRepo.findById.mockResolvedValue(contact);

    const result = await useCase.execute({
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      contactId: contact.id.toString(),
    });

    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('john@example.com');
    expect(result.id).toBe(contact.id.toString());
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
