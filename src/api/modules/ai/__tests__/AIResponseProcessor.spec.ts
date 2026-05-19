import { AIResponseProcessor } from '../application/services/AIResponseProcessor';
import { IPaymentLinkGenerator } from '../application/ports/IPaymentLinkGenerator';
import { IRepeatLastOrder } from '../application/ports/IRepeatLastOrder';

describe('AIResponseProcessor', () => {
  let processor: AIResponseProcessor;
  let paymentLinkGenerator: jest.Mocked<IPaymentLinkGenerator>;
  let reserveProfessionalSlotUseCase: any;
  let repeatLastOrderUseCase: jest.Mocked<IRepeatLastOrder>;

  beforeEach(() => {
    paymentLinkGenerator = {
      generate: jest.fn(),
    };
    reserveProfessionalSlotUseCase = {
      execute: jest.fn(),
    };
    repeatLastOrderUseCase = {
      execute: jest.fn(),
    };

    processor = new AIResponseProcessor(
      paymentLinkGenerator,
      reserveProfessionalSlotUseCase,
      repeatLastOrderUseCase,
    );
  });

  it('should keep the text unchanged when there is no payment tag', async () => {
    const result = await processor.process('Texto simples sem tag', 'tenant-1');

    expect(result).toBe('Texto simples sem tag');
    expect(paymentLinkGenerator.generate).not.toHaveBeenCalled();
  });

  it('should replace a payment tag with the generated payment link', async () => {
    paymentLinkGenerator.generate.mockResolvedValue({
      id: 'link-1',
      url: 'https://pay.test/link-1',
    });

    const result = await processor.process(
      'Segue o pagamento: [PAYMENT_LINK: Corte Premium, 59.90]',
      'tenant-1',
    );

    expect(paymentLinkGenerator.generate).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      name: 'Corte Premium',
      value: 59.9,
    });
    expect(result).toBe(
      'Segue o pagamento: Clique aqui para pagar: https://pay.test/link-1',
    );
  });

  it('should replace the tag with a fallback message when payment link generation fails', async () => {
    paymentLinkGenerator.generate.mockRejectedValue(new Error('gateway down'));

    const result = await processor.process(
      'Segue o pagamento: [PAYMENT_LINK: Corte Premium, 59.90]',
      'tenant-1',
    );

    expect(result).toContain('Link de pagamento momentaneamente indispon');
  });

  it('should only process the first payment tag occurrence', async () => {
    paymentLinkGenerator.generate.mockResolvedValue({
      id: 'link-1',
      url: 'https://pay.test/link-1',
    });

    const result = await processor.process(
      'Primeiro [PAYMENT_LINK: Corte, 39.90] segundo [PAYMENT_LINK: Barba, 19.90]',
      'tenant-1',
    );

    expect(paymentLinkGenerator.generate).toHaveBeenCalledTimes(1);
    expect(result).toContain('Clique aqui para pagar: https://pay.test/link-1');
    expect(result).toContain('[PAYMENT_LINK: Barba, 19.90]');
  });

  it('should reserve a scheduling slot from an internal scheduling action', async () => {
    reserveProfessionalSlotUseCase.execute.mockResolvedValue({
      id: '2030-07-20__19:00__20:00',
      startsAt: '19:00',
      endsAt: '20:00',
      status: 'PRE_RESERVED',
      reservedFor: {
        categoryName: 'Consulta premium',
      },
      payment: {
        linkUrl: 'https://pay.test/scheduling',
      },
    });

    const result = await processor.process(
      'Pode ser esse horário. [SCHEDULE_SLOT: professionalId=prof-1, date=2030-07-20, slotId=2030-07-20__19:00__20:00, categoryId=cat-1, payment=required]',
      {
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        contactId: 'contact-1',
        conversationId: 'conversation-1',
      },
    );

    expect(reserveProfessionalSlotUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      professionalId: 'prof-1',
      date: '2030-07-20',
      slotId: '2030-07-20__19:00__20:00',
      categoryId: 'cat-1',
      contactId: 'contact-1',
      conversationId: 'conversation-1',
      isFree: false,
      paymentTimeoutHours: undefined,
      suppressCustomerNotification: true,
    });
    expect(result).toContain('pre-reservado');
    expect(result).toContain('https://pay.test/scheduling');
  });

  describe('[REPEAT_LAST_ORDER]', () => {
    it('should replace tag with cart summary when repeat order succeeds', async () => {
      repeatLastOrderUseCase.execute.mockResolvedValue({
        session: {
          id: 'session-1',
          subtotalAmount: 50,
          totalAmount: 50,
          items: [
            { name: 'Pizza Margherita', quantity: 2, unitPrice: 15, lineTotal: 30 },
            { name: 'Refrigerante 2L', quantity: 1, unitPrice: 20, lineTotal: 20 },
          ],
        },
        previousOrderId: 'order-1',
        itemsCopied: 2,
      });

      const result = await processor.process(
        'Vou repetir seu pedido. [REPEAT_LAST_ORDER]',
        {
          tenantId: 'tenant-1',
          branchId: 'branch-1',
          contactId: 'contact-1',
          conversationId: 'conv-1',
        },
      );

      expect(repeatLastOrderUseCase.execute).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        conversationId: 'conv-1',
        branchId: 'branch-1',
      });
      expect(result).toContain('Pizza Margherita');
      expect(result).toContain('Refrigerante 2L');
      expect(result).toContain('R$ 50.00');
      expect(result).toContain('Deseja adicionar mais algum item');
    });

    it('should replace tag with fallback message when repeat order fails', async () => {
      repeatLastOrderUseCase.execute.mockRejectedValue(
        new Error('No orders found'),
      );

      const result = await processor.process(
        'Vou repetir. [REPEAT_LAST_ORDER]',
        {
          tenantId: 'tenant-1',
          contactId: 'contact-1',
          conversationId: 'conv-1',
        },
      );

      expect(result).toContain('Não consegui repetir seu pedido anterior');
    });

    it('should replace tag with fallback when context is missing', async () => {
      const result = await processor.process(
        'Repetindo. [REPEAT_LAST_ORDER]',
        'tenant-1',
      );

      expect(result).toContain('Não consegui repetir seu pedido anterior');
    });

    it('should not process tag when text has no REPEAT_LAST_ORDER placeholder', async () => {
      const result = await processor.process('Texto normal sem tag', {
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        conversationId: 'conv-1',
      });

      expect(repeatLastOrderUseCase.execute).not.toHaveBeenCalled();
      expect(result).toBe('Texto normal sem tag');
    });
  });
});
