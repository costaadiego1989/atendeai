import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { RecoveryCaseMessagingService } from '../application/services/RecoveryCaseMessagingService';
import { TriggerRecoveryOutreachUseCase } from '../application/use-cases/TriggerRecoveryOutreachUseCase';

describe('TriggerRecoveryOutreachUseCase', () => {
  let recoveryRepository: any;
  let contactFacade: any;
  let messagingFacade: any;
  let recoveryCaseMessagingService: RecoveryCaseMessagingService;
  let recoveryOutreachGenerator: any;
  let sut: TriggerRecoveryOutreachUseCase;

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
    recoveryOutreachGenerator = {
      generate: jest.fn(),
    };
    recoveryCaseMessagingService = new RecoveryCaseMessagingService(
      contactFacade,
      messagingFacade,
    );

    const playbookRepository = {
      findActiveByTenantId: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
    };

    sut = new TriggerRecoveryOutreachUseCase(
      recoveryRepository,
      recoveryCaseMessagingService,
      recoveryOutreachGenerator,
      playbookRepository as any,
    );
  });

  it('should use the manual outreach text when provided', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1',
      branchId: 'branch-1',
      debtorName: 'Patricia',
      phone: '5511999999999',
      assignedTags: [],
    });
    contactFacade.ensureContact.mockResolvedValue({
      contactId: 'contact-1',
      created: true,
    });
    messagingFacade.queueSystemMessage.mockResolvedValue({
      conversationId: 'conversation-1',
      messageId: 'message-1',
    });
    recoveryRepository.updateCaseStatus.mockResolvedValue({
      id: 'case-1',
      status: 'CONTACTED',
    });

    const result = await sut.execute({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      messageText: 'Mensagem manual',
    });

    expect(recoveryOutreachGenerator.generate).not.toHaveBeenCalled();
    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
        text: 'Mensagem manual',
      }),
    );
    expect(result.outreachText).toBe('Mensagem manual');
  });

  it('should generate the outreach with AI when requested', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-2',
      branchId: 'branch-2',
      debtorName: 'Helena',
      debtorCompanyName: 'Clinica Bela Vida',
      chargeType: 'CONSULTATION',
      chargeTitle: 'Consulta em aberto',
      chargeDescription: 'Consulta de retorno não quitada',
      relatedEntityType: 'SERVICE_APPOINTMENT',
      relatedEntityLabel: 'Consulta retorno',
      phone: '5511999999998',
      amountDue: '89.90',
      dueDate: new Date('2030-08-10T00:00:00.000Z'),
      assignedTags: ['importação'],
    });
    contactFacade.ensureContact.mockResolvedValue({
      contactId: 'contact-2',
      created: true,
    });
    recoveryOutreachGenerator.generate.mockResolvedValue(
      'Mensagem gerada por IA',
    );
    messagingFacade.queueSystemMessage.mockResolvedValue({
      conversationId: 'conversation-2',
      messageId: 'message-2',
    });
    recoveryRepository.updateCaseStatus.mockResolvedValue({
      id: 'case-2',
      status: 'CONTACTED',
    });

    const result = await sut.execute({
      tenantId: 'tenant-1',
      caseId: 'case-2',
      generateWithAI: true,
    });

    expect(recoveryOutreachGenerator.generate).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      debtorName: 'Helena',
      debtorCompanyName: 'Clinica Bela Vida',
      chargeType: 'CONSULTATION',
      chargeTitle: 'Consulta em aberto',
      chargeDescription: 'Consulta de retorno não quitada',
      referencePeriod: undefined,
      relatedEntityType: 'SERVICE_APPOINTMENT',
      relatedEntityLabel: 'Consulta retorno',
      amountDue: '89.90',
      dueDate: new Date('2030-08-10T00:00:00.000Z'),
      assignedTags: ['importação'],
    });
    expect(result.outreachText).toBe('Mensagem gerada por IA');
  });

  it('should reject outreach when no text and no AI generation are provided', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-3',
      branchId: null,
      debtorName: 'Paulo',
      phone: '5511999999997',
      assignedTags: [],
    });

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        caseId: 'case-3',
      }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });
});
