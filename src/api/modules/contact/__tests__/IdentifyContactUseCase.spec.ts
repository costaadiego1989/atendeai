import { IdentifyContactUseCase } from '../application/use-cases/IdentifyContactUseCase';
import { IContactRepository } from '../domain/repositories/IContactRepository';
import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { TenantId } from '@shared/domain/TenantId';
import { ContactDomainEventPublisher } from '../application/services/ContactDomainEventPublisher';

describe('IdentifyContactUseCase', () => {
  let useCase: IdentifyContactUseCase;
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
    useCase = new IdentifyContactUseCase(mockRepo, publisher);
  });

  it('should identify and return existing contact and record interaction', async () => {
    const contact = Contact.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: ContactName.create('Existing User'),
      phone: '11999999999',
    });
    const initialInteraction = contact.lastInteraction;
    mockRepo.findByPhone.mockResolvedValue(contact);

    const result = await useCase.execute({
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Existing User',
      phone: '11999999999',
    });

    expect(result.id).toBe(contact.id.toString());
    expect(result.lastInteraction).not.toBe(initialInteraction);
    expect(mockRepo.save).toHaveBeenCalled();
    expect(publisher.publishFromAggregate).toHaveBeenCalledWith(contact);
  });

  it('should create new contact if not found', async () => {
    mockRepo.findByPhone.mockResolvedValue(null);

    const result = await useCase.execute({
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'New User',
      phone: '11999999999',
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('New User');
    expect(mockRepo.save).toHaveBeenCalled();
    expect(publisher.publishFromAggregate).toHaveBeenCalledTimes(1);
  });
});
