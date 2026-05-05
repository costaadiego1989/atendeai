import { ProcessRecoveryRecurringChargeUseCase } from '../application/use-cases/ProcessRecoveryRecurringChargeUseCase';

describe('ProcessRecoveryRecurringChargeUseCase', () => {
  let recurringChargeRepository: any;
  let recoveryRepository: any;
  let generatePaymentLinkUseCase: any;
  let sut: ProcessRecoveryRecurringChargeUseCase;

  beforeEach(() => {
    recurringChargeRepository = {
      findById: jest.fn(),
      releaseLease: jest.fn(),
      startRun: jest.fn(),
      markRunSucceeded: jest.fn(),
      markRunFailed: jest.fn(),
      markRunSkipped: jest.fn(),
      advanceAfterSuccess: jest.fn(),
      cancel: jest.fn(),
    };
    recoveryRepository = {
      findCaseById: jest.fn(),
    };
    generatePaymentLinkUseCase = {
      execute: jest.fn(),
    };

    sut = new ProcessRecoveryRecurringChargeUseCase(
      recurringChargeRepository,
      recoveryRepository,
      generatePaymentLinkUseCase,
    );
  });

  it('should generate a payment link, record the run and advance the next occurrence', async () => {
    const nextRunAt = new Date(Date.now() - 1_000);
    recurringChargeRepository.findById.mockResolvedValue({
      id: 'rec-1',
      tenantId: 'tenant-1',
      caseId: 'case-1',
      status: 'ACTIVE',
      billingType: 'PIX',
      intervalDays: 7,
      maxOccurrences: 3,
      occurrencesSent: 0,
      nextRunAt,
      messageTemplate:
        'Oi, {{nome}}. Reenviando {{titulo}} no valor {{valor}}: {{link}}',
    });
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1',
      debtorName: 'Ana',
      chargeTitle: 'mensalidade',
      amountDue: '120.00',
      status: 'CONTACTED',
    });
    recurringChargeRepository.startRun.mockResolvedValue({
      id: 'run-1',
    });
    generatePaymentLinkUseCase.execute.mockResolvedValue({
      paymentLinkId: 'plink-1',
      conversationId: 'conversation-1',
      messageId: 'message-1',
    });

    await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(generatePaymentLinkUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      billingType: 'PIX',
      messageText:
        'Oi, Ana. Reenviando mensalidade no valor 120.00: {{link}}',
    });
    expect(recurringChargeRepository.markRunSucceeded).toHaveBeenCalledWith({
      runId: 'run-1',
      paymentLinkId: 'plink-1',
      conversationId: 'conversation-1',
      messageId: 'message-1',
    });
    expect(recurringChargeRepository.advanceAfterSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        recurrenceId: 'rec-1',
        occurrenceNumber: 1,
        nextRunAt: expect.any(Date),
      }),
    );
  });

  it('should complete the recurrence when max occurrences is reached', async () => {
    recurringChargeRepository.findById.mockResolvedValue({
      id: 'rec-1',
      tenantId: 'tenant-1',
      caseId: 'case-1',
      status: 'ACTIVE',
      billingType: 'PIX',
      intervalDays: 7,
      maxOccurrences: 2,
      occurrencesSent: 1,
      nextRunAt: new Date(Date.now() - 1_000),
    });
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1',
      debtorName: 'Ana',
      status: 'CONTACTED',
    });
    recurringChargeRepository.startRun.mockResolvedValue({ id: 'run-2' });
    generatePaymentLinkUseCase.execute.mockResolvedValue({
      paymentLinkId: 'plink-2',
    });

    await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(recurringChargeRepository.advanceAfterSuccess).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      recurrenceId: 'rec-1',
      occurrenceNumber: 2,
      nextRunAt: null,
    });
  });

  it('should skip and cancel when the recovery case is already terminal', async () => {
    recurringChargeRepository.findById.mockResolvedValue({
      id: 'rec-1',
      tenantId: 'tenant-1',
      caseId: 'case-1',
      status: 'ACTIVE',
      billingType: 'PIX',
      intervalDays: 7,
      occurrencesSent: 0,
      nextRunAt: new Date(Date.now() - 1_000),
    });
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1',
      status: 'PAID',
    });
    recurringChargeRepository.startRun.mockResolvedValue({ id: 'run-3' });

    await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(generatePaymentLinkUseCase.execute).not.toHaveBeenCalled();
    expect(recurringChargeRepository.markRunSkipped).toHaveBeenCalledWith({
      runId: 'run-3',
      reason: 'terminal_case_PAID',
    });
    expect(recurringChargeRepository.cancel).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      recurrenceId: 'rec-1',
      reason: 'terminal_case_PAID',
    });
  });
});
