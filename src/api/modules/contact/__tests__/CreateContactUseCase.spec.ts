import { CreateContactUseCase } from '../application/use-cases/CreateContactUseCase';
import { IContactRepository } from '../domain/repositories/IContactRepository';
import { Contact } from '../domain/entities/Contact';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ContactDomainEventPublisher } from '../application/services/ContactDomainEventPublisher';

describe('CreateContactUseCase', () => {
  let useCase: CreateContactUseCase;
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

    useCase = new CreateContactUseCase(mockRepo, publisher);
  });

  it('should create a contact successfully', async () => {
    mockRepo.findByPhone.mockResolvedValue(null);

    const result = await useCase.execute({
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      phone: '5511999999999',
      tags: ['VIP'],
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('John Doe');
    expect(result.stage).toBe('LEAD');
    expect(result.tags).toContain('VIP');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(publisher.publishFromAggregate).toHaveBeenCalledTimes(1);
  });

  it('should throw if phone already exists', async () => {
    mockRepo.findByPhone.mockResolvedValue({} as Contact);

    await expect(
      useCase.execute({
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        phone: '5511999999999',
      }),
    ).rejects.toThrow(ValidationErrorException);
  });
});
