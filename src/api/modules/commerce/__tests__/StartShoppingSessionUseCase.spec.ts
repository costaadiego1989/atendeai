import { StartShoppingSessionUseCase } from '../application/use-cases/StartShoppingSessionUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { CommerceSessionStartedIntegrationEvent } from '../application/integration-events/CheckoutIntegrationEvents';

describe('StartShoppingSessionUseCase', () => {
  let useCase: StartShoppingSessionUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let eventBus: jest.Mocked<IEventBus>;

  const tenantId = 'tenant-1';
  const conversationId = 'conv-1';
  const contactId = 'contact-1';

  const mockSession = {
    id: 'session-1',
    tenantId,
    branchId: null,
    conversationId,
    contactId,
    status: 'BUILDING_CART' as const,
    currentStep: 'IDENTIFYING_NEED' as const,
    fulfillmentType: null,
    shippingMode: null,
    distanceKm: null,
    freightAmount: null,
    subtotalAmount: 0,
    totalAmount: 0,
    deliveryAddress: null,
    notes: null,
    paymentReference: null,
    paymentLinkId: null,
    paymentLinkUrl: null,
    paymentStatus: null,
    abandonmentPaused: false,
    abandonmentPausedAt: null,
    pendingQuery: null,
    pendingOptions: [],
    selectedSource: null,
    selectedInventoryItemId: null,
    selectedCatalogItemId: null,
    selectedItemName: null,
    checkedOutAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    couponCode: null,
    discountAmount: null,
  };

  beforeEach(() => {
    commerceRepo = {
      findActiveSessionByConversation: jest.fn(),
      createSession: jest.fn(),
    } as any;

    eventBus = {
      publish: jest.fn(),
    } as any;

    useCase = new StartShoppingSessionUseCase(commerceRepo, eventBus);
  });

  it('should create a new session for a contact', async () => {
    commerceRepo.findActiveSessionByConversation.mockResolvedValue(null);
    commerceRepo.createSession.mockResolvedValue(mockSession as any);
    eventBus.publish.mockResolvedValue(undefined);

    const result = await useCase.execute({
      tenantId,
      conversationId,
      contactId,
    });

    expect(result).toEqual(mockSession);
    expect(commerceRepo.createSession).toHaveBeenCalledWith({
      tenantId,
      conversationId,
      contactId,
    });
  });

  it('should associate session with conversation', async () => {
    commerceRepo.findActiveSessionByConversation.mockResolvedValue(null);
    commerceRepo.createSession.mockResolvedValue(mockSession as any);
    eventBus.publish.mockResolvedValue(undefined);

    await useCase.execute({ tenantId, conversationId, contactId });

    expect(commerceRepo.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId }),
    );
  });

  it('should return existing session if one is already active for the conversation', async () => {
    commerceRepo.findActiveSessionByConversation.mockResolvedValue(
      mockSession as any,
    );

    const result = await useCase.execute({
      tenantId,
      conversationId,
      contactId,
    });

    expect(result).toEqual(mockSession);
    expect(commerceRepo.createSession).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('should publish CommerceSessionStartedIntegrationEvent after creation', async () => {
    commerceRepo.findActiveSessionByConversation.mockResolvedValue(null);
    commerceRepo.createSession.mockResolvedValue(mockSession as any);
    eventBus.publish.mockResolvedValue(undefined);

    await useCase.execute({ tenantId, conversationId, contactId });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(CommerceSessionStartedIntegrationEvent),
    );
  });

  it('should ensure tenant isolation by passing tenantId to repository', async () => {
    const otherTenantId = 'tenant-2';
    commerceRepo.findActiveSessionByConversation.mockResolvedValue(null);
    commerceRepo.createSession.mockResolvedValue({
      ...mockSession,
      tenantId: otherTenantId,
    } as any);
    eventBus.publish.mockResolvedValue(undefined);

    await useCase.execute({
      tenantId: otherTenantId,
      conversationId,
      contactId,
    });

    expect(commerceRepo.findActiveSessionByConversation).toHaveBeenCalledWith(
      otherTenantId,
      conversationId,
    );
    expect(commerceRepo.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: otherTenantId }),
    );
  });
});
