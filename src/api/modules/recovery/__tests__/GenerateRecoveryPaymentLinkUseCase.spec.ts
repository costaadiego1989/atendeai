import { GenerateRecoveryPaymentLinkUseCase } from '../application/use-cases/GenerateRecoveryPaymentLinkUseCase';
import { BusinessException } from '@shared/domain/exceptions/DomainExceptions';
import { TERMINAL_STATUSES } from '../domain/RecoveryCaseStatus';

describe('GenerateRecoveryPaymentLinkUseCase — terminal status guard (R1)', () => {
  let recoveryRepository: any;
  let paymentFacade: any;
  let recoveryCaseMessagingService: any;
  let sut: GenerateRecoveryPaymentLinkUseCase;

  const baseCase = {
    id: 'case-1',
    tenantId: 'tenant-1',
    debtorName: 'Ana',
    chargeTitle: 'Mensalidade',
    amountDue: '120.00',
    paymentReference: null,
  };

  beforeEach(() => {
    recoveryRepository = {
      findCaseById: jest.fn(),
      setPaymentReference: jest.fn(),
      updateCaseStatus: jest.fn(),
    };
    paymentFacade = {
      createPaymentLink: jest.fn(),
    };
    recoveryCaseMessagingService = {
      queueMessage: jest.fn(),
    };

    sut = new GenerateRecoveryPaymentLinkUseCase(
      recoveryRepository,
      paymentFacade,
      recoveryCaseMessagingService,
    );
  });

  it.each(TERMINAL_STATUSES)(
    'should throw BusinessException when case status is %s',
    async (terminalStatus) => {
      recoveryRepository.findCaseById.mockResolvedValue({
        ...baseCase,
        status: terminalStatus,
      });

      await expect(
        sut.execute({
          tenantId: 'tenant-1',
          caseId: 'case-1',
        }),
      ).rejects.toThrow(BusinessException);

      expect(paymentFacade.createPaymentLink).not.toHaveBeenCalled();
      expect(recoveryCaseMessagingService.queueMessage).not.toHaveBeenCalled();
    },
  );

  it('should proceed normally for a non-terminal case (CONTACTED)', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      ...baseCase,
      status: 'CONTACTED',
    });
    paymentFacade.createPaymentLink.mockResolvedValue({
      url: 'https://pay.example.com/link-1',
    });
    recoveryCaseMessagingService.queueMessage.mockResolvedValue({
      messageId: 'msg-1',
      conversationId: 'conv-1',
    });
    recoveryRepository.updateCaseStatus.mockResolvedValue({
      ...baseCase,
      status: 'CONTACTED',
    });

    await expect(
      sut.execute({ tenantId: 'tenant-1', caseId: 'case-1' }),
    ).resolves.not.toThrow();

    expect(paymentFacade.createPaymentLink).toHaveBeenCalled();
  });
});
