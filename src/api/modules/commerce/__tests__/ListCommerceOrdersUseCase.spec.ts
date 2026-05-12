import { ListCommerceOrdersUseCase } from '../application/use-cases/ListCommerceOrdersUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';

describe('ListCommerceOrdersUseCase', () => {
  let useCase: ListCommerceOrdersUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;

  const tenantId = 'tenant-1';

  const mockOrders = [
    {
      id: 'order-1',
      tenantId,
      sessionId: 'session-1',
      conversationId: 'conv-1',
      contactId: 'contact-1',
      status: 'AWAITING_PAYMENT',
      subtotalAmount: 100,
      freightAmount: 10,
      totalAmount: 110,
      contactName: 'John',
      contactPhone: '11999999999',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'order-2',
      tenantId,
      sessionId: 'session-2',
      conversationId: 'conv-2',
      contactId: 'contact-2',
      status: 'PAID',
      subtotalAmount: 200,
      freightAmount: 0,
      totalAmount: 200,
      contactName: 'Jane',
      contactPhone: '11888888888',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    commerceRepo = {
      listOrders: jest.fn(),
    } as any;

    useCase = new ListCommerceOrdersUseCase(commerceRepo);
  });

  it('should list orders for a tenant', async () => {
    commerceRepo.listOrders.mockResolvedValue(mockOrders as any);

    const result = await useCase.execute({ tenantId });

    expect(result).toEqual(mockOrders);
    expect(commerceRepo.listOrders).toHaveBeenCalledWith({ tenantId });
  });

  it('should filter orders by status', async () => {
    const paidOrders = [mockOrders[1]];
    commerceRepo.listOrders.mockResolvedValue(paidOrders as any);

    const result = await useCase.execute({ tenantId, status: 'PAID' });

    expect(result).toHaveLength(1);
    expect(commerceRepo.listOrders).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, status: 'PAID' }),
    );
  });

  it('should filter orders by date range', async () => {
    commerceRepo.listOrders.mockResolvedValue(mockOrders as any);

    const dateFrom = new Date('2025-01-01');
    const dateTo = new Date('2025-12-31');

    await useCase.execute({ tenantId, dateFrom, dateTo });

    expect(commerceRepo.listOrders).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, dateFrom, dateTo }),
    );
  });

  it('should return empty list when no orders exist', async () => {
    commerceRepo.listOrders.mockResolvedValue([]);

    const result = await useCase.execute({ tenantId });

    expect(result).toHaveLength(0);
  });

  it('should ensure tenant isolation by passing tenantId to repository', async () => {
    commerceRepo.listOrders.mockResolvedValue([]);

    await useCase.execute({ tenantId: 'tenant-2' });

    expect(commerceRepo.listOrders).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-2' }),
    );
  });
});
