import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { RecoveryCaseMessagingService } from '../application/services/RecoveryCaseMessagingService';
import { SendRecoveryGuidanceUseCase } from '../application/use-cases/SendRecoveryGuidanceUseCase';

describe('SendRecoveryGuidanceUseCase', () => {
  let recoveryRepository: any;
  let contactFacade: any;
  let messagingFacade: any;
  let recoveryCaseMessagingService: RecoveryCaseMessagingService;
  let sut: SendRecoveryGuidanceUseCase;

  beforeEach(() => {
    recoveryRepository = {
      findCaseById: jest.fn(),
      updateCaseStatus: jest.fn(),
    };
    contactFacade = {
      ensureContact: jest.fn(),
      getContactById: jest.fn(),
    };
    messagingFacade = {
      queueSystemMessage: jest.fn(),
    };
    recoveryCaseMessagingService = new RecoveryCaseMessagingService(
      contactFacade,
      messagingFacade,
    );

    sut = new SendRecoveryGuidanceUseCase(
      recoveryRepository,
      recoveryCaseMessagingService,
    );
  });

  it('should send the current suggestion to the customer', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1',
      branchId: 'branch-1',
      contactId: 'contact-1',
      debtorName: 'Cliente',
      phone: '5511999990000',
      status: 'NEGOTIATING',
      suggestedReply: 'Podemos parcelar em duas vezes.',
      assignedTags: ['recovery'],
    });
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'contact-1',
      name: 'Cliente',
      phone: '5511999990000',
      branchId: 'branch-1',
    });
    messagingFacade.queueSystemMessage.mockResolvedValue({
      conversationId: 'conv-1',
      messageId: 'msg-1',
    });
    recoveryRepository.updateCaseStatus.mockResolvedValue({
      id: 'case-1',
      status: 'NEGOTIATING',
      suggestedReply: 'Podemos parcelar em duas vezes.',
    });

    const result = await sut.execute({
      tenantId: 'tenant-1',
      caseId: 'case-1',
    });

    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      branchId: 'branch-1',
      channel: 'WHATSAPP',
      text: 'Podemos parcelar em duas vezes.',
    });
    expect(recoveryRepository.updateCaseStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        caseId: 'case-1',
        status: 'NEGOTIATING',
        contactId: 'contact-1',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        conversationId: 'conv-1',
        messageId: 'msg-1',
        sentText: 'Podemos parcelar em duas vezes.',
      }),
    );
  });

  it('should reject when there is no suggestion to send', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-2',
      status: 'CONTACTED',
      suggestedReply: null,
    });

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        caseId: 'case-2',
      }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });
});
