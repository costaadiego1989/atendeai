import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ScheduleRecoveryRecurringChargeUseCase } from '../application/use-cases/ScheduleRecoveryRecurringChargeUseCase';

describe('ScheduleRecoveryRecurringChargeUseCase', () => {
  let recoveryRepository: any;
  let recurringChargeRepository: any;
  let sut: ScheduleRecoveryRecurringChargeUseCase;

  beforeEach(() => {
    recoveryRepository = {
      findCaseById: jest.fn(),
      updateCaseStatus: jest.fn(),
    };
    recurringChargeRepository = {
      create: jest.fn(),
    };

    sut = new ScheduleRecoveryRecurringChargeUseCase(
      recoveryRepository,
      recurringChargeRepository,
    );
  });

  it('should persist an active recurrence and update the next case action', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1',
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      amountDue: '90.00',
      status: 'READY_TO_CONTACT',
    });
    recurringChargeRepository.create.mockResolvedValue({
      id: 'rec-1',
      tenantId: 'tenant-1',
      caseId: 'case-1',
      nextRunAt: new Date('2030-01-01T10:00:00.000Z'),
    });
    recoveryRepository.updateCaseStatus.mockResolvedValue({});

    const result = await sut.execute({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      billingType: 'PIX',
      intervalDays: 7,
      maxOccurrences: 4,
      firstRunAt: new Date('2030-01-01T10:00:00.000Z'),
      messageTemplate: 'Mensagem {{link}}',
      createdByUserId: 'user-1',
      createdByUserEmail: 'admin@test.com',
    });

    expect(recurringChargeRepository.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      caseId: 'case-1',
      billingType: 'PIX',
      intervalDays: 7,
      maxOccurrences: 4,
      firstRunAt: new Date('2030-01-01T10:00:00.000Z'),
      messageTemplate: 'Mensagem {{link}}',
      createdByUserId: 'user-1',
      createdByUserEmail: 'admin@test.com',
    });
    expect(recoveryRepository.updateCaseStatus).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      status: 'CONTACTED',
      nextActionAt: new Date('2030-01-01T10:00:00.000Z'),
    });
    expect(result.id).toBe('rec-1');
  });

  it('should reject invalid intervals and terminal cases', async () => {
    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        caseId: 'case-1',
        intervalDays: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationErrorException);

    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1',
      amountDue: '90.00',
      status: 'PAID',
    });

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        caseId: 'case-1',
        intervalDays: 7,
      }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });
});
