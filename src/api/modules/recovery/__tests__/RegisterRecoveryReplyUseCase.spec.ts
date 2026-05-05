import { RegisterRecoveryReplyUseCase } from '../application/use-cases/RegisterRecoveryReplyUseCase';
import { RecoveryReplyPolicy } from '../application/services/RecoveryReplyPolicy';

describe('RegisterRecoveryReplyUseCase', () => {
  let recoveryRepository: any;
  let recoveryGuidanceGenerator: any;
  let sut: RegisterRecoveryReplyUseCase;

  beforeEach(() => {
    recoveryRepository = {
      findLatestActiveCaseByContact: jest.fn(),
      updateCaseStatus: jest.fn(),
      updateCaseGuidance: jest.fn(),
    };
    recoveryGuidanceGenerator = {
      generate: jest.fn(),
    };

    sut = new RegisterRecoveryReplyUseCase(
      recoveryRepository,
      new RecoveryReplyPolicy(),
      recoveryGuidanceGenerator,
    );
  });

  it('should classify inbound negotiation replies and persist AI guidance', async () => {
    recoveryRepository.findLatestActiveCaseByContact.mockResolvedValue({
      id: 'case-1',
      tenantId: 'tenant-1',
      debtorName: 'Cliente',
      debtorCompanyName: 'Academia Movimento',
      chargeType: 'MONTHLY_FEE',
      chargeTitle: 'Mensalidade de julho',
      chargeDescription: 'Plano premium unidade Centro',
      referencePeriod: '2030-07',
      relatedEntityType: 'SUBSCRIPTION',
      relatedEntityLabel: 'Plano Premium Centro',
      amountDue: '120.00',
      dueDate: new Date('2030-08-10T00:00:00.000Z'),
    });
    recoveryRepository.updateCaseStatus.mockResolvedValue({
      id: 'case-1',
      tenantId: 'tenant-1',
      debtorName: 'Cliente',
      debtorCompanyName: 'Academia Movimento',
      chargeType: 'MONTHLY_FEE',
      chargeTitle: 'Mensalidade de julho',
      chargeDescription: 'Plano premium unidade Centro',
      referencePeriod: '2030-07',
      relatedEntityType: 'SUBSCRIPTION',
      relatedEntityLabel: 'Plano Premium Centro',
      amountDue: '120.00',
      dueDate: new Date('2030-08-10T00:00:00.000Z'),
      status: 'NEGOTIATING',
    });
    recoveryGuidanceGenerator.generate.mockResolvedValue({
      suggestedReply: 'Posso te reenviar o link agora.',
      suggestedNextAction: 'Validar meio de pagamento.',
    });
    recoveryRepository.updateCaseGuidance.mockResolvedValue({
      id: 'case-1',
      status: 'NEGOTIATING',
      suggestedReply: 'Posso te reenviar o link agora.',
      suggestedNextAction: 'Validar meio de pagamento.',
    });

    const result = await sut.execute({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      messageText: 'consigo parcelar esse valor?',
    });

    expect(recoveryRepository.updateCaseStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        caseId: 'case-1',
        status: 'NEGOTIATING',
      }),
    );
    expect(recoveryGuidanceGenerator.generate).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      debtorName: 'Cliente',
      debtorCompanyName: 'Academia Movimento',
      chargeType: 'MONTHLY_FEE',
      chargeTitle: 'Mensalidade de julho',
      chargeDescription: 'Plano premium unidade Centro',
      referencePeriod: '2030-07',
      relatedEntityType: 'SUBSCRIPTION',
      relatedEntityLabel: 'Plano Premium Centro',
      amountDue: '120.00',
      dueDate: new Date('2030-08-10T00:00:00.000Z'),
      status: 'NEGOTIATING',
      customerMessage: 'consigo parcelar esse valor?',
    });
    expect(result).toEqual(
      expect.objectContaining({
        suggestedReply: 'Posso te reenviar o link agora.',
        suggestedNextAction: 'Validar meio de pagamento.',
      }),
    );
  });

  it('should clear stored guidance when the customer opts out', async () => {
    recoveryRepository.findLatestActiveCaseByContact.mockResolvedValue({
      id: 'case-2',
      tenantId: 'tenant-1',
      debtorName: 'Cliente',
    });
    recoveryRepository.updateCaseStatus.mockResolvedValue({
      id: 'case-2',
      status: 'STOPPED',
    });
    recoveryRepository.updateCaseGuidance.mockResolvedValue({
      id: 'case-2',
      status: 'STOPPED',
      suggestedReply: null,
      suggestedNextAction: null,
    });

    await sut.execute({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      messageText: 'pare de me mandar mensagem',
    });

    expect(recoveryGuidanceGenerator.generate).not.toHaveBeenCalled();
    expect(recoveryRepository.updateCaseGuidance).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      caseId: 'case-2',
      suggestedReply: null,
      suggestedNextAction: null,
      guidanceGeneratedAt: null,
    });
  });
});
