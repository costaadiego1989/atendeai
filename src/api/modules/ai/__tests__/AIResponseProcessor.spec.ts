import { AIResponseProcessor } from '../application/services/AIResponseProcessor';
import { IPaymentLinkGenerator } from '../application/ports/IPaymentLinkGenerator';

describe('AIResponseProcessor', () => {
  let processor: AIResponseProcessor;
  let paymentLinkGenerator: jest.Mocked<IPaymentLinkGenerator>;
  let reserveProfessionalSlotUseCase: any;

  beforeEach(() => {
    paymentLinkGenerator = {
      generate: jest.fn(),
    };
    reserveProfessionalSlotUseCase = {
      execute: jest.fn(),
    };

    processor = new AIResponseProcessor(
      paymentLinkGenerator,
      reserveProfessionalSlotUseCase,
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
    expect(result).toBe('Segue o pagamento: Clique aqui para pagar: https://pay.test/link-1');
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
});
