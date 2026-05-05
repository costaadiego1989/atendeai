import { CommerceContextProvider } from '../infrastructure/adapters/CommerceContextProvider';
import { ICommerceRepository } from '@modules/commerce/domain/ports/ICommerceRepository';
import { SearchCommerceCatalogUseCase } from '@modules/commerce/application/use-cases/SearchCommerceCatalogUseCase';

describe('CommerceContextProvider', () => {
  let commerceRepository: jest.Mocked<ICommerceRepository>;
  let searchCommerceCatalogUseCase: jest.Mocked<SearchCommerceCatalogUseCase>;
  let provider: CommerceContextProvider;

  beforeEach(() => {
    commerceRepository = {
      upsertShippingPolicy: jest.fn(),
      findShippingPolicyByTenantId: jest.fn(),
      createSession: jest.fn(),
      findActiveSessionByConversation: jest.fn(),
      findSessionById: jest.fn(),
      addSessionItem: jest.fn(),
      updateSessionState: jest.fn(),
      createOrder: jest.fn(),
      findOrderById: jest.fn(),
      listOrders: jest.fn(),
      findOrderByPaymentReference: jest.fn(),
      markOrderPaidByPaymentReference: jest.fn(),
      findCatalogItemById: jest.fn(),
      findInventoryItemById: jest.fn(),
    } as unknown as jest.Mocked<ICommerceRepository>;

    searchCommerceCatalogUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SearchCommerceCatalogUseCase>;

    provider = new CommerceContextProvider(
      commerceRepository,
      searchCommerceCatalogUseCase,
    );
  });

  it('should build numbered catalog options for transactional businesses', async () => {
    commerceRepository.findActiveSessionByConversation.mockResolvedValue(null);
    commerceRepository.findShippingPolicyByTenantId.mockResolvedValue(null);
    searchCommerceCatalogUseCase.execute.mockResolvedValue([
      {
        optionNumber: 1,
        source: 'INVENTORY',
        inventoryItemId: 'inv-1',
        catalogItemId: 'cat-1',
        name: 'Cafe torrado 500g',
        price: 14.9,
        currency: 'BRL',
        availableQuantity: 12,
        availabilityStatus: 'AVAILABLE',
        categoryName: null,
      },
      {
        optionNumber: 2,
        source: 'CATALOG',
        inventoryItemId: undefined,
        catalogItemId: 'cat-2',
        name: 'Cafe gourmet 250g',
        price: 22.5,
        currency: 'BRL',
        availableQuantity: null,
        availabilityStatus: null,
        categoryName: 'Bebidas',
      },
    ]);

    const result = await provider.findConversationContext({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      businessType: 'MARKET',
      userMessage: 'tem cafe?',
    });

    expect(result).toContain('Commerce flow context:');
    expect(result).toContain('Commerce catalog matches:');
    expect(result).toContain('1. Cafe torrado 500g');
    expect(result).toContain('2. Cafe gourmet 250g');
    expect(result).toContain('reply only with the option number');
  });

  it('should summarize the current shopping session and next step', async () => {
    commerceRepository.findActiveSessionByConversation.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      status: 'READY_FOR_CHECKOUT',
      currentStep: 'AWAITING_ORDER_NOTE',
      fulfillmentType: 'DELIVERY',
      shippingMode: 'PER_KM',
      distanceKm: 4,
      freightAmount: 12,
      subtotalAmount: 31.8,
      totalAmount: 43.8,
      deliveryAddress: 'Rua das Laranjeiras, 45',
      notes: 'Deixar na portaria',
      paymentReference: null,
      paymentLinkId: null,
      paymentLinkUrl: null,
      paymentStatus: null,
      pendingQuery: null,
      pendingOptions: [],
      selectedSource: null,
      selectedInventoryItemId: null,
      selectedCatalogItemId: null,
      selectedItemName: null,
      checkedOutAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: 'item-1',
          sessionId: 'session-1',
          tenantId: 'tenant-1',
          source: 'INVENTORY',
          inventoryItemId: 'inv-1',
          catalogItemId: 'cat-1',
          name: 'Pao frances',
          quantity: 6,
          unitPrice: 1.3,
          lineTotal: 7.8,
          currency: 'BRL',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'item-2',
          sessionId: 'session-1',
          tenantId: 'tenant-1',
          source: 'CATALOG',
          inventoryItemId: null,
          catalogItemId: 'cat-2',
          name: 'Cafe torrado 500g',
          quantity: 2,
          unitPrice: 12,
          lineTotal: 24,
          currency: 'BRL',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    commerceRepository.findShippingPolicyByTenantId.mockResolvedValue({
      tenantId: 'tenant-1',
      mode: 'PER_KM',
      fixedAmount: null,
      pricePerKm: 4.5,
      minimumAmount: 12,
      maxRadiusKm: 8,
      servicedNeighborhoods: [],
      deliverySchedule: [
        {
          weekday: 'MONDAY',
          enabled: true,
          startTime: '09:00',
          endTime: '18:00',
        },
      ],
      notes: 'Entregas até as 18h.',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    searchCommerceCatalogUseCase.execute.mockResolvedValue([]);

    const result = await provider.findConversationContext({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      businessType: 'BAKERY',
      userMessage: 'fechar pedido',
    });

    expect(result).toContain('Shopping session context:');
    expect(result).toContain('Pao frances x6');
    expect(result).toContain('Cafe torrado 500g x2');
    expect(result).toContain('Subtotal: BRL 31.80');
    expect(result).toContain('Freight: BRL 12.00');
    expect(result).toContain('Total: BRL 43.80');
    expect(result).toContain('Customer note: Deixar na portaria');
    expect(result).toContain('Monday 09:00-18:00');
    expect(result).toContain('leave a delivery or pickup note');
  });
});
