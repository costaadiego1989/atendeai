import { SetOrderTrackingCodeUseCase } from '../application/use-cases/SetOrderTrackingCodeUseCase';
import { ICommerceRepository, CommerceOrderRecord } from '../domain/ports/ICommerceRepository';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { OrderNotFoundError } from '../domain/errors/OrderNotFoundError';
import { CommerceOrderTrackingSetIntegrationEvent } from '../application/integration-events/CheckoutIntegrationEvents';

describe('SetOrderTrackingCodeUseCase', () => {
  let useCase: SetOrderTrackingCodeUseCase;
  let repository: jest.Mocked<ICommerceRepository>;
  let eventBus: jest.Mocked<IEventBus>;

  const baseOrder: CommerceOrderRecord = {
    id: 'order-1',
    tenantId: 'tenant-1',
    branchId: null,
    sessionId: 'session-1',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    status: 'PREPARING',
    fulfillmentType: 'DELIVERY',
    shippingMode: 'FIXED',
    subtotalAmount: 100,
    freightAmount: 10,
    totalAmount: 110,
    deliveryAddress: 'Rua A, 123',
    paymentReference: 'ref-1',
    paymentLinkId: null,
    paymentLinkUrl: null,
    couponCode: null,
    discountAmount: null,
    paymentStatus: 'PAID',
    paidAt: new Date(),
    trackingCode: null,
    trackingUrl: null,
    trackingNotifiedAt: null,
    carrier: null,
    carrierServiceName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      findOrderById: jest.fn(),
      updateOrderTracking: jest.fn(),
      saveAuditLog: jest.fn(),
    } as any;
    eventBus = {
      publish: jest.fn(),
    } as any;
    useCase = new SetOrderTrackingCodeUseCase(repository, eventBus);
  });

  it('should set tracking code with explicit URL and publish event', async () => {
    repository.findOrderById.mockResolvedValue(baseOrder);
    const updatedOrder = { ...baseOrder, trackingCode: 'BR123456789', trackingUrl: 'https://track.com/BR123456789' };
    repository.updateOrderTracking.mockResolvedValue(updatedOrder);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'BR123456789',
      trackingUrl: 'https://track.com/BR123456789',
      userId: 'user-1',
      userName: 'Admin',
    });

    expect(result.trackingCode).toBe('BR123456789');
    expect(repository.updateOrderTracking).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'BR123456789',
      trackingUrl: 'https://track.com/BR123456789',
      carrier: null,
    });
    expect(repository.saveAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        event: 'ORDER_TRACKING_SET',
        entityId: 'order-1',
        entityType: 'ORDER',
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(CommerceOrderTrackingSetIntegrationEvent),
    );
  });

  it('should auto-generate trackingUrl from CORREIOS carrier', async () => {
    repository.findOrderById.mockResolvedValue(baseOrder);
    repository.updateOrderTracking.mockResolvedValue({
      ...baseOrder,
      trackingCode: 'BR123456789BR',
      trackingUrl: 'https://rastreio.correios.com.br/app/index.php?objetos=BR123456789BR',
      carrier: 'CORREIOS',
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'BR123456789BR',
      carrier: 'CORREIOS',
    });

    expect(repository.updateOrderTracking).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'BR123456789BR',
      trackingUrl: 'https://rastreio.correios.com.br/app/index.php?objetos=BR123456789BR',
      carrier: 'CORREIOS',
    });
  });

  it('should auto-generate trackingUrl from JADLOG carrier', async () => {
    repository.findOrderById.mockResolvedValue(baseOrder);
    repository.updateOrderTracking.mockResolvedValue({
      ...baseOrder,
      trackingCode: 'JDL123',
      trackingUrl: 'https://www.jadlog.com.br/tracking?code=JDL123',
      carrier: 'JADLOG',
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'JDL123',
      carrier: 'JADLOG',
    });

    expect(repository.updateOrderTracking).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'JDL123',
      trackingUrl: 'https://www.jadlog.com.br/tracking?code=JDL123',
      carrier: 'JADLOG',
    });
  });

  it('should auto-generate trackingUrl from MELHOR_ENVIO carrier', async () => {
    repository.findOrderById.mockResolvedValue(baseOrder);
    repository.updateOrderTracking.mockResolvedValue({
      ...baseOrder,
      trackingCode: 'ME123',
      trackingUrl: 'https://app.melhorenvio.com.br/shipment/tracking/ME123',
      carrier: 'MELHOR_ENVIO',
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'ME123',
      carrier: 'MELHOR_ENVIO',
    });

    expect(repository.updateOrderTracking).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'ME123',
      trackingUrl: 'https://app.melhorenvio.com.br/shipment/tracking/ME123',
      carrier: 'MELHOR_ENVIO',
    });
  });

  it('should not auto-generate trackingUrl for OTHER carrier', async () => {
    repository.findOrderById.mockResolvedValue(baseOrder);
    repository.updateOrderTracking.mockResolvedValue({
      ...baseOrder,
      trackingCode: 'XYZ123',
      carrier: 'OTHER',
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'XYZ123',
      carrier: 'OTHER',
    });

    expect(repository.updateOrderTracking).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'XYZ123',
      trackingUrl: null,
      carrier: 'OTHER',
    });
  });

  it('should prefer explicit trackingUrl over auto-generated', async () => {
    repository.findOrderById.mockResolvedValue(baseOrder);
    repository.updateOrderTracking.mockResolvedValue({
      ...baseOrder,
      trackingCode: 'BR123',
      trackingUrl: 'https://custom.com/BR123',
      carrier: 'CORREIOS',
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'BR123',
      trackingUrl: 'https://custom.com/BR123',
      carrier: 'CORREIOS',
    });

    expect(repository.updateOrderTracking).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'BR123',
      trackingUrl: 'https://custom.com/BR123',
      carrier: 'CORREIOS',
    });
  });

  it('should throw OrderNotFoundError when order does not exist', async () => {
    repository.findOrderById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        orderId: 'non-existent',
        trackingCode: 'BR123',
      }),
    ).rejects.toThrow(OrderNotFoundError);
  });

  it('should reject tracking for CANCELLED orders', async () => {
    repository.findOrderById.mockResolvedValue({ ...baseOrder, status: 'CANCELLED' });

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        orderId: 'order-1',
        trackingCode: 'BR123',
      }),
    ).rejects.toThrow('Cannot set tracking code');
  });

  it('should reject tracking for AWAITING_PAYMENT orders', async () => {
    repository.findOrderById.mockResolvedValue({ ...baseOrder, status: 'AWAITING_PAYMENT' });

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        orderId: 'order-1',
        trackingCode: 'BR123',
      }),
    ).rejects.toThrow('Cannot set tracking code');
  });

  it('should allow tracking for OUT_FOR_DELIVERY orders', async () => {
    repository.findOrderById.mockResolvedValue({ ...baseOrder, status: 'OUT_FOR_DELIVERY' });
    repository.updateOrderTracking.mockResolvedValue({ ...baseOrder, status: 'OUT_FOR_DELIVERY', trackingCode: 'BR123' });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'BR123',
    });

    expect(result.trackingCode).toBe('BR123');
  });

  it('should allow tracking for PAID orders', async () => {
    repository.findOrderById.mockResolvedValue({ ...baseOrder, status: 'PAID' });
    repository.updateOrderTracking.mockResolvedValue({ ...baseOrder, status: 'PAID', trackingCode: 'BR123' });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'BR123',
    });

    expect(result.trackingCode).toBe('BR123');
  });

  it('should work without trackingUrl and without carrier', async () => {
    repository.findOrderById.mockResolvedValue(baseOrder);
    repository.updateOrderTracking.mockResolvedValue({ ...baseOrder, trackingCode: 'BR123' });

    await useCase.execute({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'BR123',
    });

    expect(repository.updateOrderTracking).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      trackingCode: 'BR123',
      trackingUrl: null,
      carrier: null,
    });
  });
});
