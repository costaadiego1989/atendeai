import { Logger } from '@nestjs/common';
import { AdvanceCommerceConversationUseCase } from '../application/use-cases/AdvanceCommerceConversationUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';

describe('AdvanceCommerceConversationUseCase', () => {
  let useCase: AdvanceCommerceConversationUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let startShoppingSessionUseCase: any;
  let applyCouponUseCase: any;
  let conversationFlowRules: any;
  let conversationSearchService: any;
  let identifyNeedStepHandler: any;
  let selectingItemStepHandler: any;
  let awaitingQuantityStepHandler: any;
  let askingMoreItemsStepHandler: any;
  let awaitingFulfillmentStepHandler: any;
  let awaitingShippingMethodStepHandler: any;
  let awaitingCarrierCepStepHandler: any;
  let awaitingCarrierOptionStepHandler: any;
  let awaitingDeliveryAddressStepHandler: any;
  let awaitingOrderNoteStepHandler: any;
  let readyForCheckoutStepHandler: any;

  const tenantId = 'tenant-1';
  const conversationId = 'conv-1';
  const contactId = 'contact-1';

  const mockSession = {
    id: 'session-1',
    tenantId,
    conversationId,
    contactId,
    status: 'BUILDING_CART' as const,
    currentStep: 'IDENTIFYING_NEED' as const,
    items: [],
    pendingOptions: [],
  };

  beforeEach(() => {
    commerceRepo = {
      findActiveSessionByConversation: jest.fn(),
      updateSessionState: jest.fn(),
    } as any;

    startShoppingSessionUseCase = { execute: jest.fn() };
    applyCouponUseCase = { execute: jest.fn() };

    conversationFlowRules = {
      isTransactionalBusiness: jest.fn(),
      normalize: jest.fn((v: string) => v.toLowerCase().trim()),
    };

    conversationSearchService = {
      searchCatalog: jest.fn(),
    };

    identifyNeedStepHandler = { handle: jest.fn() };
    selectingItemStepHandler = { handle: jest.fn() };
    awaitingQuantityStepHandler = { handle: jest.fn() };
    askingMoreItemsStepHandler = { handle: jest.fn() };
    awaitingFulfillmentStepHandler = { handle: jest.fn() };
    awaitingShippingMethodStepHandler = { handle: jest.fn() };
    awaitingCarrierCepStepHandler = { handle: jest.fn() };
    awaitingCarrierOptionStepHandler = { handle: jest.fn() };
    awaitingDeliveryAddressStepHandler = { handle: jest.fn() };
    awaitingOrderNoteStepHandler = { handle: jest.fn() };
    readyForCheckoutStepHandler = { handle: jest.fn() };

    useCase = new AdvanceCommerceConversationUseCase(
      commerceRepo,
      startShoppingSessionUseCase,
      applyCouponUseCase,
      conversationFlowRules,
      conversationSearchService,
      identifyNeedStepHandler,
      selectingItemStepHandler,
      awaitingQuantityStepHandler,
      askingMoreItemsStepHandler,
      awaitingFulfillmentStepHandler,
      awaitingShippingMethodStepHandler,
      awaitingCarrierCepStepHandler,
      awaitingCarrierOptionStepHandler,
      awaitingDeliveryAddressStepHandler,
      awaitingOrderNoteStepHandler,
      readyForCheckoutStepHandler,
    );
  });

  it('should return null when business type is not transactional', async () => {
    conversationFlowRules.isTransactionalBusiness.mockReturnValue(false);

    const result = await useCase.execute({
      tenantId,
      conversationId,
      contactId,
      businessType: 'consulting',
      userMessage: 'hello',
    });

    expect(result).toBeNull();
    expect(commerceRepo.findActiveSessionByConversation).not.toHaveBeenCalled();
  });

  it('should create a new session when no active session exists and catalog matches found', async () => {
    conversationFlowRules.isTransactionalBusiness.mockReturnValue(true);
    commerceRepo.findActiveSessionByConversation.mockResolvedValue(null);
    conversationSearchService.searchCatalog.mockResolvedValue([
      { optionNumber: 1, name: 'Pizza', source: 'CATALOG' },
    ]);
    startShoppingSessionUseCase.execute.mockResolvedValue(mockSession);
    commerceRepo.updateSessionState.mockResolvedValue({
      ...mockSession,
      currentStep: 'SELECTING_ITEM',
    } as any);

    const result = await useCase.execute({
      tenantId,
      conversationId,
      contactId,
      businessType: 'food',
      userMessage: 'quero pizza',
    });

    expect(startShoppingSessionUseCase.execute).toHaveBeenCalled();
    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({ currentStep: 'SELECTING_ITEM' }),
    );
    expect(result).toBeDefined();
  });

  it('should return null when no session exists and no catalog matches found', async () => {
    conversationFlowRules.isTransactionalBusiness.mockReturnValue(true);
    commerceRepo.findActiveSessionByConversation.mockResolvedValue(null);
    conversationSearchService.searchCatalog.mockResolvedValue([]);

    const result = await useCase.execute({
      tenantId,
      conversationId,
      contactId,
      businessType: 'food',
      userMessage: 'oi',
    });

    expect(result).toBeNull();
    expect(startShoppingSessionUseCase.execute).not.toHaveBeenCalled();
  });

  it('should delegate to the correct step handler based on currentStep', async () => {
    conversationFlowRules.isTransactionalBusiness.mockReturnValue(true);
    const sessionAtQuantity = {
      ...mockSession,
      currentStep: 'AWAITING_QUANTITY' as const,
    };
    commerceRepo.findActiveSessionByConversation.mockResolvedValue(
      sessionAtQuantity as any,
    );
    awaitingQuantityStepHandler.handle.mockResolvedValue({
      ...sessionAtQuantity,
      currentStep: 'ASKING_MORE_ITEMS',
    });

    await useCase.execute({
      tenantId,
      conversationId,
      contactId,
      businessType: 'food',
      userMessage: '3',
    });

    expect(awaitingQuantityStepHandler.handle).toHaveBeenCalled();
    expect(identifyNeedStepHandler.handle).not.toHaveBeenCalled();
    expect(selectingItemStepHandler.handle).not.toHaveBeenCalled();
  });

  it('should log a warning and attach a structured warning when coupon application fails', async () => {
    conversationFlowRules.isTransactionalBusiness.mockReturnValue(true);
    const buildingSession = {
      ...mockSession,
      currentStep: 'SELECTING_ITEM' as const,
    };
    commerceRepo.findActiveSessionByConversation.mockResolvedValue(
      buildingSession as any,
    );
    applyCouponUseCase.execute.mockRejectedValue(
      new Error('Coupon has expired'),
    );
    selectingItemStepHandler.handle.mockImplementation(
      (ctx: any) => ctx.session,
    );

    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const result: any = await useCase.execute({
      tenantId,
      conversationId,
      contactId,
      businessType: 'food',
      userMessage: 'cupom: PROMO10',
    });

    expect(applyCouponUseCase.execute).toHaveBeenCalledWith({
      tenantId,
      sessionId: buildingSession.id,
      code: 'PROMO10',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Coupon application failed'),
      expect.objectContaining({
        tenantId,
        sessionId: buildingSession.id,
        code: 'PROMO10',
      }),
    );
    expect(result.warning).toEqual({
      type: 'COUPON_APPLICATION_FAILED',
      code: 'PROMO10',
      message: 'Coupon has expired',
    });

    warnSpy.mockRestore();
  });

  it('should return session as-is for terminal steps (AWAITING_PAYMENT, PAID, CANCELLED)', async () => {
    conversationFlowRules.isTransactionalBusiness.mockReturnValue(true);
    const paidSession = { ...mockSession, currentStep: 'PAID' as const };
    commerceRepo.findActiveSessionByConversation.mockResolvedValue(
      paidSession as any,
    );

    const result = await useCase.execute({
      tenantId,
      conversationId,
      contactId,
      businessType: 'food',
      userMessage: 'oi',
    });

    expect(result).toEqual(paidSession);
    expect(identifyNeedStepHandler.handle).not.toHaveBeenCalled();
    expect(readyForCheckoutStepHandler.handle).not.toHaveBeenCalled();
  });
});
