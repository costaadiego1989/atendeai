import { QuoteCarrierShippingUseCase } from '../application/use-cases/QuoteCarrierShippingUseCase';
import { AwaitingShippingMethodStepHandler } from '../application/services/conversation/AwaitingShippingMethodStepHandler';
import { AwaitingCarrierCepStepHandler } from '../application/services/conversation/AwaitingCarrierCepStepHandler';
import { AwaitingCarrierOptionStepHandler } from '../application/services/conversation/AwaitingCarrierOptionStepHandler';
import {
  ICommerceRepository,
  CommerceSessionRecord,
  CommercePendingOptionRecord,
} from '../domain/ports/ICommerceRepository';
import {
  ICarrierShippingAdapter,
  CarrierShippingOption,
} from '../domain/ports/ICarrierShippingAdapter';
import { IBranchOriginCepPort } from '../domain/ports/IBranchOriginCepPort';
import { CommerceConversationFlowRules } from '../application/services/conversation/CommerceConversationFlowRules';

// ─── Shared Fixtures ────────────────────────────────────────────────────────

const baseMockSession: CommerceSessionRecord = {
  id: 'session-1',
  tenantId: 'tenant-1',
  branchId: 'branch-1',
  conversationId: 'conv-1',
  contactId: 'contact-1',
  status: 'BUILDING_CART',
  currentStep: 'AWAITING_CARRIER_CEP',
  fulfillmentType: 'DELIVERY',
  shippingMode: 'CARRIER',
  distanceKm: null,
  freightAmount: null,
  subtotalAmount: 100,
  totalAmount: 100,
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
  carrierCep: null,
  carrierServiceCode: null,
  carrierServiceName: null,
  carrierDeliveryDays: null,
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
      catalogItemId: null,
      name: 'Camiseta P',
      quantity: 2,
      unitPrice: 50,
      lineTotal: 100,
      currency: 'BRL',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  couponCode: null,
  discountAmount: null,
};

// ─── QuoteCarrierShippingUseCase ────────────────────────────────────────────

describe('QuoteCarrierShippingUseCase', () => {
  let useCase: QuoteCarrierShippingUseCase;
  let carrierAdapter: jest.Mocked<ICarrierShippingAdapter>;

  beforeEach(() => {
    carrierAdapter = {
      quoteShipping: jest.fn(),
    };

    useCase = new QuoteCarrierShippingUseCase(carrierAdapter);
  });

  it('consolidates package weight as sum of items * quantity', async () => {
    carrierAdapter.quoteShipping.mockResolvedValue({ options: [] });

    await useCase.execute({
      originCep: '01001000',
      destinationCep: '20040020',
      items: [
        { weightGrams: 200, heightCm: 10, widthCm: 15, lengthCm: 20, quantity: 3 },
        { weightGrams: 500, heightCm: 5, widthCm: 12, lengthCm: 18, quantity: 2 },
      ],
    });

    expect(carrierAdapter.quoteShipping).toHaveBeenCalledWith(
      expect.objectContaining({
        weightGrams: 200 * 3 + 500 * 2, // 1600g
      }),
    );
  });

  it('uses default dimensions when items have no weight/dimensions', async () => {
    carrierAdapter.quoteShipping.mockResolvedValue({ options: [] });

    await useCase.execute({
      originCep: '01001000',
      destinationCep: '20040020',
      items: [
        { weightGrams: null, heightCm: null, widthCm: null, lengthCm: null, quantity: 2 },
      ],
    });

    // Default: 300g weight, 5cm height, 15cm width, 20cm length
    expect(carrierAdapter.quoteShipping).toHaveBeenCalledWith(
      expect.objectContaining({
        weightGrams: 300 * 2, // 600g
        heightCm: 5,
        widthCm: 15,
        lengthCm: 20,
      }),
    );
  });

  it('enforces minimum package dimensions', async () => {
    carrierAdapter.quoteShipping.mockResolvedValue({ options: [] });

    await useCase.execute({
      originCep: '01001000',
      destinationCep: '20040020',
      items: [
        { weightGrams: 50, heightCm: 1, widthCm: 5, lengthCm: 10, quantity: 1 },
      ],
    });

    // Minimums: height=2, width=11, length=16
    expect(carrierAdapter.quoteShipping).toHaveBeenCalledWith(
      expect.objectContaining({
        heightCm: 2,
        widthCm: 11,
        lengthCm: 16,
      }),
    );
  });

  it('filters out unavailable options', async () => {
    carrierAdapter.quoteShipping.mockResolvedValue({
      options: [
        {
          serviceCode: '1',
          serviceName: 'PAC',
          carrierName: 'Correios',
          price: 25.5,
          deliveryDays: 7,
          available: true,
        },
        {
          serviceCode: '2',
          serviceName: 'SEDEX',
          carrierName: 'Correios',
          price: 45.0,
          deliveryDays: 3,
          available: false,
          errorMessage: 'Dimensões excedem o limite',
        },
      ],
    });

    const result = await useCase.execute({
      originCep: '01001000',
      destinationCep: '20040020',
      items: [{ weightGrams: 300, heightCm: 5, widthCm: 15, lengthCm: 20, quantity: 1 }],
    });

    expect(result.options).toHaveLength(1);
    expect(result.options[0].serviceName).toBe('PAC');
  });

  it('sorts available options by price ascending', async () => {
    carrierAdapter.quoteShipping.mockResolvedValue({
      options: [
        {
          serviceCode: '3',
          serviceName: 'Jadlog .Package',
          carrierName: 'Jadlog',
          price: 30.0,
          deliveryDays: 5,
          available: true,
        },
        {
          serviceCode: '1',
          serviceName: 'PAC',
          carrierName: 'Correios',
          price: 20.0,
          deliveryDays: 7,
          available: true,
        },
        {
          serviceCode: '2',
          serviceName: 'SEDEX',
          carrierName: 'Correios',
          price: 45.0,
          deliveryDays: 3,
          available: true,
        },
      ],
    });

    const result = await useCase.execute({
      originCep: '01001000',
      destinationCep: '20040020',
      items: [{ weightGrams: 300, heightCm: 5, widthCm: 15, lengthCm: 20, quantity: 1 }],
    });

    expect(result.options[0].price).toBe(20.0);
    expect(result.options[1].price).toBe(30.0);
    expect(result.options[2].price).toBe(45.0);
  });

  it('returns empty array when adapter returns no options', async () => {
    carrierAdapter.quoteShipping.mockResolvedValue({ options: [] });

    const result = await useCase.execute({
      originCep: '01001000',
      destinationCep: '20040020',
      items: [{ weightGrams: 300, heightCm: 5, widthCm: 15, lengthCm: 20, quantity: 1 }],
    });

    expect(result.options).toEqual([]);
  });
});

// ─── AwaitingShippingMethodStepHandler ──────────────────────────────────────

describe('AwaitingShippingMethodStepHandler', () => {
  let handler: AwaitingShippingMethodStepHandler;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let conversationFlowRules: CommerceConversationFlowRules;

  const session: CommerceSessionRecord = {
    ...baseMockSession,
    currentStep: 'AWAITING_SHIPPING_METHOD',
  };

  const input = {
    tenantId: 'tenant-1',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    userMessage: '1',
  };

  beforeEach(() => {
    commerceRepo = {
      updateSessionState: jest.fn(),
      findShippingPolicyByTenantId: jest.fn(),
    } as any;

    conversationFlowRules = new CommerceConversationFlowRules();

    handler = new AwaitingShippingMethodStepHandler(
      commerceRepo,
      conversationFlowRules,
    );
  });

  it('routes to AWAITING_DELIVERY_ADDRESS when user picks "1" (local)', async () => {
    commerceRepo.findShippingPolicyByTenantId.mockResolvedValue({
      tenantId: 'tenant-1',
      mode: 'FIXED',
      fixedAmount: 10,
      pricePerKm: null,
      minimumAmount: null,
      maxRadiusKm: null,
      servicedNeighborhoods: [],
      deliverySchedule: [],
      notes: null,
      active: true,
      carrierShippingEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    commerceRepo.updateSessionState.mockResolvedValue({
      ...session,
      currentStep: 'AWAITING_DELIVERY_ADDRESS',
    });

    await handler.handle({
      input,
      session,
      userMessage: '1',
      normalizedMessage: '1',
    });

    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: 'AWAITING_DELIVERY_ADDRESS',
        fulfillmentType: 'DELIVERY',
      }),
    );
  });

  it('routes to AWAITING_CARRIER_CEP when user picks "2" (carrier)', async () => {
    commerceRepo.updateSessionState.mockResolvedValue({
      ...session,
      currentStep: 'AWAITING_CARRIER_CEP',
      shippingMode: 'CARRIER',
    });

    await handler.handle({
      input,
      session,
      userMessage: '2',
      normalizedMessage: '2',
    });

    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: 'AWAITING_CARRIER_CEP',
        fulfillmentType: 'DELIVERY',
        shippingMode: 'CARRIER',
      }),
    );
  });

  it('routes to AWAITING_CARRIER_CEP when user says "transportadora"', async () => {
    commerceRepo.updateSessionState.mockResolvedValue({
      ...session,
      currentStep: 'AWAITING_CARRIER_CEP',
      shippingMode: 'CARRIER',
    });

    await handler.handle({
      input,
      session,
      userMessage: 'quero enviar por transportadora',
      normalizedMessage: 'quero enviar por transportadora',
    });

    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: 'AWAITING_CARRIER_CEP',
        shippingMode: 'CARRIER',
      }),
    );
  });

  it('returns session unchanged when input is unrecognized', async () => {
    const result = await handler.handle({
      input,
      session,
      userMessage: 'banana',
      normalizedMessage: 'banana',
    });

    expect(result).toBe(session);
    expect(commerceRepo.updateSessionState).not.toHaveBeenCalled();
  });

  it('routes to AWAITING_FREIGHT_REVIEW for PER_KM local delivery', async () => {
    commerceRepo.findShippingPolicyByTenantId.mockResolvedValue({
      tenantId: 'tenant-1',
      mode: 'PER_KM',
      fixedAmount: null,
      pricePerKm: 2.5,
      minimumAmount: null,
      maxRadiusKm: 15,
      servicedNeighborhoods: [],
      deliverySchedule: [],
      notes: null,
      active: true,
      carrierShippingEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    commerceRepo.updateSessionState.mockResolvedValue({
      ...session,
      currentStep: 'AWAITING_FREIGHT_REVIEW',
      shippingMode: 'PER_KM',
    });

    await handler.handle({
      input,
      session,
      userMessage: '1',
      normalizedMessage: '1',
    });

    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: 'AWAITING_FREIGHT_REVIEW',
        shippingMode: 'PER_KM',
      }),
    );
  });
});

// ─── AwaitingCarrierCepStepHandler ──────────────────────────────────────────

describe('AwaitingCarrierCepStepHandler', () => {
  let handler: AwaitingCarrierCepStepHandler;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let branchOriginCepPort: jest.Mocked<IBranchOriginCepPort>;
  let quoteCarrierShippingUseCase: jest.Mocked<QuoteCarrierShippingUseCase>;

  const session: CommerceSessionRecord = {
    ...baseMockSession,
    currentStep: 'AWAITING_CARRIER_CEP',
  };

  const input = {
    tenantId: 'tenant-1',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    userMessage: '12345-678',
  };

  beforeEach(() => {
    commerceRepo = {
      updateSessionState: jest.fn(),
    } as any;

    branchOriginCepPort = {
      getOriginCep: jest.fn(),
    };

    quoteCarrierShippingUseCase = {
      execute: jest.fn(),
    } as any;

    handler = new AwaitingCarrierCepStepHandler(
      commerceRepo,
      branchOriginCepPort,
      quoteCarrierShippingUseCase,
    );
  });

  it('extracts valid CEP from "12345-678" format', async () => {
    branchOriginCepPort.getOriginCep.mockResolvedValue('01001000');
    quoteCarrierShippingUseCase.execute.mockResolvedValue({
      options: [
        {
          serviceCode: '1',
          serviceName: 'PAC',
          carrierName: 'Correios',
          price: 25.5,
          deliveryDays: 7,
          available: true,
        },
      ],
    });
    commerceRepo.updateSessionState.mockResolvedValue({
      ...session,
      currentStep: 'AWAITING_CARRIER_OPTION',
      carrierCep: '12345678',
    });

    await handler.handle({
      input,
      session,
      userMessage: '12345-678',
      normalizedMessage: '12345-678',
    });

    expect(quoteCarrierShippingUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationCep: '12345678',
      }),
    );
  });

  it('extracts valid CEP from "12345678" format', async () => {
    branchOriginCepPort.getOriginCep.mockResolvedValue('01001000');
    quoteCarrierShippingUseCase.execute.mockResolvedValue({
      options: [
        {
          serviceCode: '1',
          serviceName: 'PAC',
          carrierName: 'Correios',
          price: 25.5,
          deliveryDays: 7,
          available: true,
        },
      ],
    });
    commerceRepo.updateSessionState.mockResolvedValue({
      ...session,
      currentStep: 'AWAITING_CARRIER_OPTION',
      carrierCep: '12345678',
    });

    await handler.handle({
      input,
      session,
      userMessage: '12345678',
      normalizedMessage: '12345678',
    });

    expect(quoteCarrierShippingUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationCep: '12345678',
      }),
    );
  });

  it('returns session unchanged for invalid CEP', async () => {
    const result = await handler.handle({
      input,
      session,
      userMessage: '123',
      normalizedMessage: '123',
    });

    expect(result).toBe(session);
    expect(branchOriginCepPort.getOriginCep).not.toHaveBeenCalled();
    expect(quoteCarrierShippingUseCase.execute).not.toHaveBeenCalled();
  });

  it('transitions to AWAITING_CARRIER_OPTION with options when quote succeeds', async () => {
    branchOriginCepPort.getOriginCep.mockResolvedValue('01001000');
    quoteCarrierShippingUseCase.execute.mockResolvedValue({
      options: [
        {
          serviceCode: '1',
          serviceName: 'PAC',
          carrierName: 'Correios',
          price: 25.5,
          deliveryDays: 7,
          available: true,
        },
        {
          serviceCode: '2',
          serviceName: 'SEDEX',
          carrierName: 'Correios',
          price: 45.0,
          deliveryDays: 3,
          available: true,
        },
      ],
    });
    commerceRepo.updateSessionState.mockResolvedValue({
      ...session,
      currentStep: 'AWAITING_CARRIER_OPTION',
      carrierCep: '20040020',
    });

    await handler.handle({
      input,
      session,
      userMessage: '20040-020',
      normalizedMessage: '20040-020',
    });

    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: 'AWAITING_CARRIER_OPTION',
        carrierCep: '20040020',
        pendingOptions: expect.arrayContaining([
          expect.objectContaining({
            optionNumber: 1,
            price: 25.5,
            attributes: expect.objectContaining({
              serviceCode: '1',
              serviceName: 'PAC',
            }),
          }),
          expect.objectContaining({
            optionNumber: 2,
            price: 45.0,
            attributes: expect.objectContaining({
              serviceCode: '2',
              serviceName: 'SEDEX',
            }),
          }),
        ]),
      }),
    );
  });

  it('stays on step when no origin CEP configured', async () => {
    branchOriginCepPort.getOriginCep.mockResolvedValue(null);

    const result = await handler.handle({
      input,
      session,
      userMessage: '12345-678',
      normalizedMessage: '12345-678',
    });

    expect(result).toBe(session);
    expect(quoteCarrierShippingUseCase.execute).not.toHaveBeenCalled();
    expect(commerceRepo.updateSessionState).not.toHaveBeenCalled();
  });

  it('stays on step when quote returns no options (but stores CEP)', async () => {
    branchOriginCepPort.getOriginCep.mockResolvedValue('01001000');
    quoteCarrierShippingUseCase.execute.mockResolvedValue({ options: [] });
    commerceRepo.updateSessionState.mockResolvedValue({
      ...session,
      carrierCep: '12345678',
      pendingOptions: [],
    });

    await handler.handle({
      input,
      session,
      userMessage: '12345-678',
      normalizedMessage: '12345-678',
    });

    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        carrierCep: '12345678',
        pendingOptions: [],
      }),
    );
    // Should NOT transition to AWAITING_CARRIER_OPTION
    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.not.objectContaining({
        currentStep: 'AWAITING_CARRIER_OPTION',
      }),
    );
  });
});

// ─── AwaitingCarrierOptionStepHandler ───────────────────────────────────────

describe('AwaitingCarrierOptionStepHandler', () => {
  let handler: AwaitingCarrierOptionStepHandler;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let conversationFlowRules: CommerceConversationFlowRules;

  const pendingOptions: CommercePendingOptionRecord[] = [
    {
      optionNumber: 1,
      source: 'CATALOG',
      name: 'PAC (Correios) — R$ 25.50 — 7 dias úteis',
      price: 25.5,
      currency: 'BRL',
      availableQuantity: null,
      availabilityStatus: null,
      categoryName: null,
      attributes: {
        serviceCode: '1',
        serviceName: 'PAC',
        carrierName: 'Correios',
        deliveryDays: 7,
      },
    },
    {
      optionNumber: 2,
      source: 'CATALOG',
      name: 'SEDEX (Correios) — R$ 45.00 — 3 dias úteis',
      price: 45.0,
      currency: 'BRL',
      availableQuantity: null,
      availabilityStatus: null,
      categoryName: null,
      attributes: {
        serviceCode: '2',
        serviceName: 'SEDEX',
        carrierName: 'Correios',
        deliveryDays: 3,
      },
    },
  ];

  const session: CommerceSessionRecord = {
    ...baseMockSession,
    currentStep: 'AWAITING_CARRIER_OPTION',
    pendingOptions,
  };

  const input = {
    tenantId: 'tenant-1',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    userMessage: '1',
  };

  beforeEach(() => {
    commerceRepo = {
      updateSessionState: jest.fn(),
    } as any;

    conversationFlowRules = new CommerceConversationFlowRules();

    handler = new AwaitingCarrierOptionStepHandler(
      commerceRepo,
      conversationFlowRules,
    );
  });

  it('selects option by number and calculates totals', async () => {
    commerceRepo.updateSessionState.mockResolvedValue({
      ...session,
      currentStep: 'AWAITING_ORDER_NOTE',
      freightAmount: 25.5,
      totalAmount: 125.5,
    });

    await handler.handle({
      input,
      session,
      userMessage: '1',
      normalizedMessage: '1',
    });

    // subtotal=100, freight=25.50, discount=0 → total=125.50
    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: 'AWAITING_ORDER_NOTE',
        carrierServiceCode: '1',
        carrierServiceName: 'PAC',
        carrierDeliveryDays: 7,
        freightAmount: 25.5,
        subtotalAmount: 100,
        totalAmount: 125.5,
        pendingOptions: [],
      }),
    );
  });

  it('transitions to AWAITING_ORDER_NOTE with carrier details stored', async () => {
    commerceRepo.updateSessionState.mockResolvedValue({
      ...session,
      currentStep: 'AWAITING_ORDER_NOTE',
      carrierServiceCode: '2',
      carrierServiceName: 'SEDEX',
      carrierDeliveryDays: 3,
      freightAmount: 45.0,
    });

    await handler.handle({
      input,
      session,
      userMessage: '2',
      normalizedMessage: '2',
    });

    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: 'AWAITING_ORDER_NOTE',
        carrierServiceCode: '2',
        carrierServiceName: 'SEDEX',
        carrierDeliveryDays: 3,
        freightAmount: 45.0,
        totalAmount: 145.0,
      }),
    );
  });

  it('returns session unchanged when selection is invalid', async () => {
    const result = await handler.handle({
      input,
      session,
      userMessage: 'abc',
      normalizedMessage: 'abc',
    });

    expect(result).toBe(session);
    expect(commerceRepo.updateSessionState).not.toHaveBeenCalled();
  });

  it('returns session unchanged when selection number is out of range', async () => {
    const result = await handler.handle({
      input,
      session,
      userMessage: '5',
      normalizedMessage: '5',
    });

    expect(result).toBe(session);
    expect(commerceRepo.updateSessionState).not.toHaveBeenCalled();
  });

  it('accounts for discount when calculating total', async () => {
    const sessionWithDiscount: CommerceSessionRecord = {
      ...session,
      discountAmount: 10,
    };

    commerceRepo.updateSessionState.mockResolvedValue({
      ...sessionWithDiscount,
      currentStep: 'AWAITING_ORDER_NOTE',
      freightAmount: 25.5,
      totalAmount: 115.5,
    });

    await handler.handle({
      input,
      session: sessionWithDiscount,
      userMessage: '1',
      normalizedMessage: '1',
    });

    // subtotal=100, freight=25.50, discount=10 → total=115.50
    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 115.5,
      }),
    );
  });
});
