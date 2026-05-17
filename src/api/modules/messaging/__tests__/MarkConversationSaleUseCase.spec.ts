import { MarkConversationSaleUseCase } from '../application/use-cases/MarkConversationSaleUseCase';

describe('MarkConversationSaleUseCase', () => {
  function createConversationRepository() {
    return {
      findById: jest.fn(),
    };
  }

  function createPrismaMock() {
    return {
      user: {
        findFirst: jest.fn(),
      },
      conversationSaleEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
  }

  it('approves the sale when there is objective evidence from a confirmed payment', async () => {
    const conversationRepository = createConversationRepository();
    conversationRepository.findById.mockResolvedValue({
      id: 'conversation-1',
      tenantId: { toString: () => 'tenant-1' },
    });

    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.conversationSaleEvent.findFirst.mockResolvedValueOnce(null);
    prisma.conversationSaleEvent.create.mockResolvedValue({
      id: 'sale-1',
      conversationId: 'conversation-1',
      attributedUserId: 'user-1',
      saleAmount: { toString: () => '345' },
      currency: 'BRL',
      lifecycleStatus: 'ACTIVE',
      aiValidationStatus: 'APPROVED',
      markedByUserId: 'user-1',
      markedAt: new Date('2026-05-06T18:20:00.000Z'),
      aiValidatedAt: new Date('2026-05-06T18:20:00.000Z'),
      notes: null,
    });

    const manualSaleEligibility = {
      supportsManualSaleAttribution: jest.fn().mockResolvedValue(true),
    };
    const saleAiValidation = {
      validate: jest.fn(),
    };
    const saleEvidence = {
      resolve: jest.fn().mockResolvedValue({
        confirmed: true,
        saleEligible: true,
        source: 'PAYMENT_CONFIRMED',
        amount: 345,
        currency: 'BRL',
        module: 'PROPOSAL',
        paymentLinkId: 'payment-link-1',
      }),
    };

    const sut = new MarkConversationSaleUseCase(
      conversationRepository as any,
      prisma as any,
      manualSaleEligibility as any,
      saleAiValidation as any,
      saleEvidence as any,
    );

    const result = await sut.execute({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      actorUserId: 'user-1',
      actorRole: 'OWNER',
    });

    expect(saleAiValidation.validate).not.toHaveBeenCalled();
    expect(prisma.conversationSaleEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: 'conversation-1',
          saleAmount: expect.anything(),
          metadata: expect.objectContaining({
            objectiveEvidence: expect.objectContaining({
              source: 'PAYMENT_CONFIRMED',
              module: 'PROPOSAL',
              paymentLinkId: 'payment-link-1',
            }),
          }),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        approved: true,
        conversationId: 'conversation-1',
        saleAmount: '345',
      }),
    );
  });

  it('returns not approved when there is no objective evidence and the ai denies the sale', async () => {
    const conversationRepository = createConversationRepository();
    conversationRepository.findById.mockResolvedValue({
      id: 'conversation-2',
      tenantId: { toString: () => 'tenant-1' },
    });

    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.conversationSaleEvent.findFirst.mockResolvedValueOnce(null);

    const manualSaleEligibility = {
      supportsManualSaleAttribution: jest.fn().mockResolvedValue(true),
    };
    const saleAiValidation = {
      validate: jest.fn().mockResolvedValue({
        approved: false,
        reason: 'Apenas proposta enviada, sem aceite ou pagamento.',
        confidence: 0.22,
        rawModelText: '{"approved":false}',
      }),
    };
    const saleEvidence = {
      resolve: jest.fn().mockResolvedValue({
        confirmed: false,
      }),
    };

    const sut = new MarkConversationSaleUseCase(
      conversationRepository as any,
      prisma as any,
      manualSaleEligibility as any,
      saleAiValidation as any,
      saleEvidence as any,
    );

    const result = await sut.execute({
      tenantId: 'tenant-1',
      conversationId: 'conversation-2',
      actorUserId: 'user-1',
      actorRole: 'OWNER',
      saleAmount: 345,
    });

    expect(saleAiValidation.validate).toHaveBeenCalled();
    expect(prisma.conversationSaleEvent.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      approved: false,
      reason: 'Apenas proposta enviada, sem aceite ou pagamento.',
      confidence: 0.22,
      conversationId: 'conversation-2',
    });
  });

  it('does not treat recovery payment as a new sale', async () => {
    const conversationRepository = createConversationRepository();
    conversationRepository.findById.mockResolvedValue({
      id: 'conversation-3',
      tenantId: { toString: () => 'tenant-1' },
    });

    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.conversationSaleEvent.findFirst.mockResolvedValueOnce(null);

    const manualSaleEligibility = {
      supportsManualSaleAttribution: jest.fn().mockResolvedValue(true),
    };
    const saleAiValidation = {
      validate: jest.fn(),
    };
    const saleEvidence = {
      resolve: jest.fn().mockResolvedValue({
        confirmed: true,
        saleEligible: false,
        source: 'PAYMENT_CONFIRMED',
        amount: 199,
        currency: 'BRL',
        module: 'RECOVERY',
        commercialKind: 'RECOVERY',
        commercialStatus: 'RECOVERED',
        paymentLinkId: 'payment-link-recovery-1',
        reason:
          'Pagamento confirmado em recovery conta como receita recuperada, não como nova venda.',
      }),
    };

    const sut = new MarkConversationSaleUseCase(
      conversationRepository as any,
      prisma as any,
      manualSaleEligibility as any,
      saleAiValidation as any,
      saleEvidence as any,
    );

    const result = await sut.execute({
      tenantId: 'tenant-1',
      conversationId: 'conversation-3',
      actorUserId: 'user-1',
      actorRole: 'OWNER',
    });

    expect(saleAiValidation.validate).not.toHaveBeenCalled();
    expect(prisma.conversationSaleEvent.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      approved: false,
      reason:
        'Pagamento confirmado em recovery conta como receita recuperada, não como nova venda.',
      confidence: 1,
      conversationId: 'conversation-3',
      commercialKind: 'RECOVERY',
      commercialStatus: 'RECOVERED',
      evidenceSource: 'PAYMENT_CONFIRMED',
    });
  });
});
