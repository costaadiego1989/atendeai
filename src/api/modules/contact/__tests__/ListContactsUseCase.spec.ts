import { ListContactsUseCase } from '../application/use-cases/ListContactsUseCase';
import { IContactRepository } from '../domain/repositories/IContactRepository';
import { Contact } from '../domain/entities/Contact';
import { ContactName } from '../domain/value-objects/ContactName';
import { TenantId } from '@shared/domain/TenantId';

describe('ListContactsUseCase', () => {
  let useCase: ListContactsUseCase;
  let mockRepo: jest.Mocked<IContactRepository>;

  beforeEach(() => {
    mockRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findAllByTenant: jest.fn(),
    } as unknown as jest.Mocked<IContactRepository>;
    useCase = new ListContactsUseCase(mockRepo);
  });

  it('should return paginated list of contacts', async () => {
    const contact = Contact.create({
      tenantId: TenantId.create('123e4567-e89b-12d3-a456-426614174000'),
      name: ContactName.create('Lead User'),
      phone: '11999999999',
      tags: ['VIP'],
    });

    mockRepo.findAllByTenant.mockResolvedValue({
      data: [contact],
      total: 1,
    });

    const result = await useCase.execute({
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      page: 1,
      limit: 10,
    });

    expect(result.data.length).toBe(1);
    expect(result.data[0].phone).toBe('11999999999');
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
    expect(mockRepo.findAllByTenant).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174000',
      { page: 1, limit: 10, stage: undefined, tag: undefined },
    );
  });
});
