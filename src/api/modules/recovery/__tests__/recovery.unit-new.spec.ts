import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';

import { CreateRecoveryCaseUseCase } from '../application/use-cases/CreateRecoveryCaseUseCase';
import { UpdateRecoveryCaseStatusUseCase } from '../application/use-cases/UpdateRecoveryCaseStatusUseCase';
import { CancelRecoveryRecurringChargeUseCase } from '../application/use-cases/CancelRecoveryRecurringChargeUseCase';
import { GetRecoveryCaseUseCase } from '../application/use-cases/GetRecoveryCaseUseCase';
import { ListRecoveryCasesUseCase } from '../application/use-cases/ListRecoveryCasesUseCase';
import { GenerateRecoveryReportUseCase } from '../application/use-cases/GenerateRecoveryReportUseCase';
import { CreateRecoveryPlaybookUseCase } from '../application/use-cases/CreateRecoveryPlaybookUseCase';
import { ActivateRecoveryPlaybookUseCase } from '../application/use-cases/ActivateRecoveryPlaybookUseCase';
import { ListRecoveryPlaybooksUseCase } from '../application/use-cases/ListRecoveryPlaybooksUseCase';
import { ListRecoveryRecurringChargesUseCase } from '../application/use-cases/ListRecoveryRecurringChargesUseCase';
import { StartRecoveryReportExportUseCase } from '../application/use-cases/StartRecoveryReportExportUseCase';
import { SeedDefaultRecoveryPlaybookUseCase } from '../application/use-cases/SeedDefaultRecoveryPlaybookUseCase';
import { RecoveryPaymentEventHandler } from '../application/handlers/RecoveryPaymentEventHandler';
import { RecoveryRecurringChargeDueHandler } from '../application/handlers/RecoveryRecurringChargeDueHandler';
import { RecoveryMessageReceivedHandler } from '../application/handlers/RecoveryMessageReceivedHandler';
import { RecoveryReportCsvBuilder } from '../application/services/RecoveryReportCsvBuilder';
import { isTerminalStatus, TERMINAL_STATUSES } from '../domain/RecoveryCaseStatus';
import { applyRecoveryPlaybookTemplate, daysPastDue } from '../application/services/recoveryPlaybookTemplate';
import { AIRecoveryOutreachGenerator } from '../infrastructure/adapters/AIRecoveryOutreachGenerator';


// ─────────────────────────────────────────────────────────────────────────────
// Helpers / shared factories
// ─────────────────────────────────────────────────────────────────────────────

function makeCase(overrides: Partial<any> = {}): any {
  return {
    id: 'case-1',
    tenantId: 'tenant-1',
    branchId: null,
    contactId: null,
    debtorName: 'Test Debtor',
    debtorCompanyName: null,
    debtorDocument: null,
    phone: '5511999990001',
    externalReference: null,
    paymentReference: null,
    source: 'MANUAL',
    chargeType: null,
    chargeTitle: null,
    chargeDescription: null,
    referencePeriod: null,
    relatedEntityType: null,
    relatedEntityId: null,
    relatedEntityLabel: null,
    amountDue: '100.00',
    dueDate: null,
    status: 'READY_TO_CONTACT',
    assignedTags: [],
    lastContactedAt: null,
    nextActionAt: null,
    paidAt: null,
    suggestedReply: null,
    suggestedNextAction: null,
    guidanceGeneratedAt: null,
    playbookId: null,
    playbookPhaseIndex: 0,
    lastPlaybookPhaseExecutedAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeRecurrence(overrides: Partial<any> = {}): any {
  return {
    id: 'rec-1',
    tenantId: 'tenant-1',
    caseId: 'case-1',
    status: 'ACTIVE',
    billingType: 'PIX',
    intervalDays: 7,
    maxOccurrences: 3,
    occurrencesSent: 0,
    firstRunAt: new Date('2030-09-01T00:00:00.000Z'),
    nextRunAt: new Date(Date.now() - 60_000),
    lastRunAt: null,
    messageTemplate: null,
    lastError: null,
    leaseUntil: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// isTerminalStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('isTerminalStatus', () => {
  it('should return true for PAID', () => {
    expect(isTerminalStatus('PAID')).toBe(true);
  });

  it('should return true for STOPPED', () => {
    expect(isTerminalStatus('STOPPED')).toBe(true);
  });

  it('should return true for INVALID_CONTACT', () => {
    expect(isTerminalStatus('INVALID_CONTACT')).toBe(true);
  });

  it('should return true for CANCELLED', () => {
    expect(isTerminalStatus('CANCELLED')).toBe(true);
  });

  it('should return true for FAILED_RECURRING', () => {
    expect(isTerminalStatus('FAILED_RECURRING')).toBe(true);
  });

  it('should return false for READY_TO_CONTACT', () => {
    expect(isTerminalStatus('READY_TO_CONTACT')).toBe(false);
  });

  it('should return false for CONTACTED', () => {
    expect(isTerminalStatus('CONTACTED')).toBe(false);
  });

  it('should return false for NEGOTIATING', () => {
    expect(isTerminalStatus('NEGOTIATING')).toBe(false);
  });

  it('should return false for PROMISE_TO_PAY', () => {
    expect(isTerminalStatus('PROMISE_TO_PAY')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(isTerminalStatus('')).toBe(false);
  });

  it('should return false for an unknown status string', () => {
    expect(isTerminalStatus('UNKNOWN_STATUS')).toBe(false);
  });

  it('should cover all five terminal statuses exhaustively', () => {
    expect(TERMINAL_STATUSES).toHaveLength(5);
    for (const s of TERMINAL_STATUSES) {
      expect(isTerminalStatus(s)).toBe(true);
    }
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// applyRecoveryPlaybookTemplate / daysPastDue
// ─────────────────────────────────────────────────────────────────────────────

describe('applyRecoveryPlaybookTemplate', () => {
  const baseCase = makeCase({
    debtorName: 'Ana',
    debtorCompanyName: 'Academia Forma',
    chargeTitle: 'Mensalidade Jul',
    amountDue: '199.90',
    dueDate: new Date('2030-07-15T00:00:00.000Z'),
    phone: '5511999990002',
  });

  it('should replace all known placeholders in a template', () => {
    const result = applyRecoveryPlaybookTemplate(
      'Oi {{debtorName}}, sua {{chargeTitle}} de R$ {{amountDue}} venceu em {{dueDate}}.',
      baseCase,
    );
    expect(result).toBe('Oi Ana, sua Mensalidade Jul de R$ 199.90 venceu em 2030-07-15.');
  });

  it('should replace debtorCompanyName placeholder', () => {
    const result = applyRecoveryPlaybookTemplate('Empresa: {{debtorCompanyName}}', baseCase);
    expect(result).toBe('Empresa: Academia Forma');
  });

  it('should replace phone placeholder', () => {
    const result = applyRecoveryPlaybookTemplate('Fone: {{phone}}', baseCase);
    expect(result).toBe('Fone: 5511999990002');
  });

  it('should replace an unknown placeholder with an empty string', () => {
    const result = applyRecoveryPlaybookTemplate('{{unknownKey}}', baseCase);
    expect(result).toBe('');
  });

  it('should replace multiple unknown placeholders in one string with empty strings', () => {
    const result = applyRecoveryPlaybookTemplate('{{foo}} and {{bar}}', baseCase);
    expect(result).toBe(' and ');
  });

  it('should return template unchanged when it contains no placeholders', () => {
    const template = 'Sem placeholders aqui';
    const result = applyRecoveryPlaybookTemplate(template, baseCase);
    expect(result).toBe(template);
  });

  it('should treat null amountDue as empty string in placeholder', () => {
    const caseWithNullAmount = makeCase({ amountDue: null });
    const result = applyRecoveryPlaybookTemplate('Valor: {{amountDue}}', caseWithNullAmount);
    expect(result).toBe('Valor: ');
  });

  it('should treat null dueDate as empty string in placeholder', () => {
    const caseWithNullDate = makeCase({ dueDate: null });
    const result = applyRecoveryPlaybookTemplate('Vence: {{dueDate}}', caseWithNullDate);
    expect(result).toBe('Vence: ');
  });

  it('should handle placeholders with extra whitespace inside braces', () => {
    const result = applyRecoveryPlaybookTemplate('{{ debtorName }}', baseCase);
    expect(result).toBe('Ana');
  });
});

describe('daysPastDue', () => {
  it('should return 0 when dueDate is null', () => {
    expect(daysPastDue(null, new Date())).toBe(0);
  });

  it('should return 0 when dueDate is undefined', () => {
    expect(daysPastDue(undefined, new Date())).toBe(0);
  });

  it('should return 0 when dueDate equals now', () => {
    const today = new Date('2030-08-01T12:00:00.000Z');
    const dueDate = new Date('2030-08-01T06:00:00.000Z');
    expect(daysPastDue(dueDate, today)).toBe(0);
  });

  it('should return correct positive days when overdue', () => {
    const now = new Date('2030-08-11T00:00:00.000Z');
    const dueDate = new Date('2030-08-01T00:00:00.000Z');
    expect(daysPastDue(dueDate, now)).toBe(10);
  });

  it('should return 0 when due date is in the future', () => {
    const now = new Date('2030-07-01T00:00:00.000Z');
    const dueDate = new Date('2030-08-01T00:00:00.000Z');
    expect(daysPastDue(dueDate, now)).toBe(0);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// CreateRecoveryCaseUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('CreateRecoveryCaseUseCase', () => {
  let recoveryRepository: any;
  let contactFacade: any;
  let playbookRepository: any;
  let configService: any;
  let sut: CreateRecoveryCaseUseCase;

  const buildSut = (playbooksEnabled = false) => {
    recoveryRepository = { createCase: jest.fn() };
    contactFacade = { getContactById: jest.fn(), ensureContact: jest.fn() };
    playbookRepository = {
      ensureSystemDefaultPlaybook: jest.fn().mockResolvedValue(null),
      findActivePlaybookWithPhases: jest.fn().mockResolvedValue(null),
    };
    configService = {
      get: jest.fn((key: string) =>
        key === 'RECOVERY_PLAYBOOKS_ENABLED' ? (playbooksEnabled ? 'true' : 'false') : undefined,
      ),
    };
    sut = new CreateRecoveryCaseUseCase(
      recoveryRepository,
      contactFacade,
      playbookRepository,
      configService,
    );
  };

  beforeEach(() => buildSut());

  it('should throw ValidationErrorException when contactId is provided but contact is not found', async () => {
    contactFacade.getContactById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', contactId: 'missing-contact' }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });

  it('should throw ValidationErrorException when neither contactId nor debtorName+phone is provided', async () => {
    await expect(
      sut.execute({ tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });

  it('should throw ValidationErrorException when debtorName is whitespace-only', async () => {
    await expect(
      sut.execute({ tenantId: 'tenant-1', debtorName: '   ', phone: '5511999990001' }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });

  it('should throw ValidationErrorException when phone is whitespace-only', async () => {
    await expect(
      sut.execute({ tenantId: 'tenant-1', debtorName: 'João', phone: '   ' }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });

  it('should trim debtorName and phone before persisting', async () => {
    recoveryRepository.createCase.mockResolvedValue(makeCase());

    await sut.execute({
      tenantId: 'tenant-1',
      debtorName: '  Ana  ',
      phone: '  5511999990001  ',
    });

    expect(recoveryRepository.createCase).toHaveBeenCalledWith(
      expect.objectContaining({
        debtorName: 'Ana',
        phone: '5511999990001',
      }),
    );
  });

  it('should set source to CRM when contactId is provided', async () => {
    contactFacade.getContactById.mockResolvedValue({
      id: 'contact-1',
      name: 'Carlos',
      phone: '5511999990002',
      branchId: null,
    });
    recoveryRepository.createCase.mockResolvedValue(makeCase({ source: 'CRM' }));

    await sut.execute({ tenantId: 'tenant-1', contactId: 'contact-1' });

    expect(recoveryRepository.createCase).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'CRM' }),
    );
  });

  it('should set source to MANUAL when no contactId is provided', async () => {
    recoveryRepository.createCase.mockResolvedValue(makeCase());

    await sut.execute({ tenantId: 'tenant-1', debtorName: 'Ana', phone: '5511999990001' });

    expect(recoveryRepository.createCase).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'MANUAL' }),
    );
  });

  it('should set playbookId from active playbook when playbooksEnabled is true', async () => {
    buildSut(true);
    playbookRepository.findActivePlaybookWithPhases.mockResolvedValue({
      playbook: { id: 'pb-1' },
      phases: [],
    });
    recoveryRepository.createCase.mockResolvedValue(makeCase({ playbookId: 'pb-1' }));

    await sut.execute({ tenantId: 'tenant-1', debtorName: 'Ana', phone: '5511999990001' });

    expect(recoveryRepository.createCase).toHaveBeenCalledWith(
      expect.objectContaining({ playbookId: 'pb-1' }),
    );
  });

  it('should set playbookId to null when playbooksEnabled is true but no active playbook exists', async () => {
    buildSut(true);
    playbookRepository.findActivePlaybookWithPhases.mockResolvedValue(null);
    recoveryRepository.createCase.mockResolvedValue(makeCase({ playbookId: null }));

    await sut.execute({ tenantId: 'tenant-1', debtorName: 'Ana', phone: '5511999990001' });

    expect(recoveryRepository.createCase).toHaveBeenCalledWith(
      expect.objectContaining({ playbookId: null }),
    );
  });

  it('should not touch playbookRepository when playbooksEnabled is false', async () => {
    recoveryRepository.createCase.mockResolvedValue(makeCase());

    await sut.execute({ tenantId: 'tenant-1', debtorName: 'Ana', phone: '5511999990001' });

    expect(playbookRepository.ensureSystemDefaultPlaybook).not.toHaveBeenCalled();
    expect(playbookRepository.findActivePlaybookWithPhases).not.toHaveBeenCalled();
  });

  it('should convert dueDate string to a Date object at midnight UTC', async () => {
    recoveryRepository.createCase.mockResolvedValue(makeCase());

    await sut.execute({
      tenantId: 'tenant-1',
      debtorName: 'Ana',
      phone: '5511999990001',
      dueDate: '2030-08-15',
    });

    expect(recoveryRepository.createCase).toHaveBeenCalledWith(
      expect.objectContaining({
        dueDate: new Date('2030-08-15T00:00:00.000Z'),
      }),
    );
  });

  it('should inherit name and phone from contact when not explicitly provided', async () => {
    contactFacade.getContactById.mockResolvedValue({
      id: 'contact-1',
      name: 'Maria Contact',
      phone: '5511988880001',
      branchId: null,
    });
    recoveryRepository.createCase.mockResolvedValue(makeCase());

    await sut.execute({ tenantId: 'tenant-1', contactId: 'contact-1' });

    expect(recoveryRepository.createCase).toHaveBeenCalledWith(
      expect.objectContaining({
        debtorName: 'Maria Contact',
        phone: '5511988880001',
      }),
    );
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// UpdateRecoveryCaseStatusUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('UpdateRecoveryCaseStatusUseCase', () => {
  let recoveryRepository: any;
  let sut: UpdateRecoveryCaseStatusUseCase;

  beforeEach(() => {
    recoveryRepository = {
      findCaseById: jest.fn(),
      updateCaseStatus: jest.fn(),
    };
    sut = new UpdateRecoveryCaseStatusUseCase(recoveryRepository);
  });

  it('should throw EntityNotFoundException when case does not exist', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', caseId: 'missing-id', status: 'CONTACTED' }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should throw EntityNotFoundException with the correct caseId in the message', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', caseId: 'bad-case-id', status: 'CONTACTED' }),
    ).rejects.toThrow('bad-case-id');
  });

  it('should throw ValidationErrorException when PROMISE_TO_PAY has an invalid nextActionAt', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(makeCase());

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        caseId: 'case-1',
        status: 'PROMISE_TO_PAY',
        nextActionAt: 'not-a-date',
      }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });

  it('should set lastContactedAt when status is CONTACTED', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(makeCase());
    recoveryRepository.updateCaseStatus.mockResolvedValue(makeCase({ status: 'CONTACTED', lastContactedAt: new Date() }));

    await sut.execute({ tenantId: 'tenant-1', caseId: 'case-1', status: 'CONTACTED' });

    const call = recoveryRepository.updateCaseStatus.mock.calls[0][0];
    expect(call.lastContactedAt).toBeInstanceOf(Date);
  });

  it('should set lastContactedAt when status is NEGOTIATING', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(makeCase());
    recoveryRepository.updateCaseStatus.mockResolvedValue(makeCase({ status: 'NEGOTIATING' }));

    await sut.execute({ tenantId: 'tenant-1', caseId: 'case-1', status: 'NEGOTIATING' });

    const call = recoveryRepository.updateCaseStatus.mock.calls[0][0];
    expect(call.lastContactedAt).toBeInstanceOf(Date);
  });

  it('should set lastContactedAt when status is PROMISE_TO_PAY with a valid date', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(makeCase());
    recoveryRepository.updateCaseStatus.mockResolvedValue(makeCase({ status: 'PROMISE_TO_PAY' }));

    await sut.execute({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      status: 'PROMISE_TO_PAY',
      nextActionAt: '2030-08-20T14:00:00.000Z',
    });

    const call = recoveryRepository.updateCaseStatus.mock.calls[0][0];
    expect(call.lastContactedAt).toBeInstanceOf(Date);
    expect(call.nextActionAt).toEqual(new Date('2030-08-20T14:00:00.000Z'));
  });

  it('should NOT set lastContactedAt when status is PAID', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(makeCase());
    recoveryRepository.updateCaseStatus.mockResolvedValue(makeCase({ status: 'PAID' }));

    await sut.execute({ tenantId: 'tenant-1', caseId: 'case-1', status: 'PAID' });

    const call = recoveryRepository.updateCaseStatus.mock.calls[0][0];
    expect(call.lastContactedAt).toBeUndefined();
  });

  it('should NOT set lastContactedAt when status is STOPPED', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(makeCase());
    recoveryRepository.updateCaseStatus.mockResolvedValue(makeCase({ status: 'STOPPED' }));

    await sut.execute({ tenantId: 'tenant-1', caseId: 'case-1', status: 'STOPPED' });

    const call = recoveryRepository.updateCaseStatus.mock.calls[0][0];
    expect(call.lastContactedAt).toBeUndefined();
  });

  it('should pass nextActionAt as undefined when not provided', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(makeCase());
    recoveryRepository.updateCaseStatus.mockResolvedValue(makeCase());

    await sut.execute({ tenantId: 'tenant-1', caseId: 'case-1', status: 'CONTACTED' });

    const call = recoveryRepository.updateCaseStatus.mock.calls[0][0];
    expect(call.nextActionAt).toBeUndefined();
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// CancelRecoveryRecurringChargeUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('CancelRecoveryRecurringChargeUseCase', () => {
  let recurringChargeRepository: any;
  let sut: CancelRecoveryRecurringChargeUseCase;

  beforeEach(() => {
    recurringChargeRepository = {
      findById: jest.fn(),
      cancel: jest.fn(),
    };
    sut = new CancelRecoveryRecurringChargeUseCase(recurringChargeRepository);
  });

  it('should throw EntityNotFoundException when recurrence is not found', async () => {
    recurringChargeRepository.findById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', recurrenceId: 'missing-rec' }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should throw EntityNotFoundException with the recurrenceId in the message', async () => {
    recurringChargeRepository.findById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', recurrenceId: 'bad-rec-id' }),
    ).rejects.toThrow('bad-rec-id');
  });

  it('should return the recurrence without calling cancel when status is CANCELLED', async () => {
    const cancelled = makeRecurrence({ status: 'CANCELLED' });
    recurringChargeRepository.findById.mockResolvedValue(cancelled);

    const result = await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(recurringChargeRepository.cancel).not.toHaveBeenCalled();
    expect(result).toBe(cancelled);
  });

  it('should return the recurrence without calling cancel when status is COMPLETED', async () => {
    const completed = makeRecurrence({ status: 'COMPLETED' });
    recurringChargeRepository.findById.mockResolvedValue(completed);

    const result = await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(recurringChargeRepository.cancel).not.toHaveBeenCalled();
    expect(result).toBe(completed);
  });

  it('should call cancel for an ACTIVE recurrence', async () => {
    recurringChargeRepository.findById.mockResolvedValue(makeRecurrence({ status: 'ACTIVE' }));
    const cancelledResult = makeRecurrence({ status: 'CANCELLED', nextRunAt: null });
    recurringChargeRepository.cancel.mockResolvedValue(cancelledResult);

    const result = await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(recurringChargeRepository.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', recurrenceId: 'rec-1' }),
    );
    expect(result.status).toBe('CANCELLED');
  });

  it('should call cancel for a PAUSED recurrence', async () => {
    recurringChargeRepository.findById.mockResolvedValue(makeRecurrence({ status: 'PAUSED' }));
    recurringChargeRepository.cancel.mockResolvedValue(makeRecurrence({ status: 'CANCELLED' }));

    await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(recurringChargeRepository.cancel).toHaveBeenCalled();
  });

  it('should default reason to cancelled_by_user when omitted', async () => {
    recurringChargeRepository.findById.mockResolvedValue(makeRecurrence({ status: 'ACTIVE' }));
    recurringChargeRepository.cancel.mockResolvedValue(makeRecurrence({ status: 'CANCELLED' }));

    await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(recurringChargeRepository.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'cancelled_by_user' }),
    );
  });

  it('should forward a custom reason when provided', async () => {
    recurringChargeRepository.findById.mockResolvedValue(makeRecurrence({ status: 'ACTIVE' }));
    recurringChargeRepository.cancel.mockResolvedValue(makeRecurrence({ status: 'CANCELLED' }));

    await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1', reason: 'customer_request' });

    expect(recurringChargeRepository.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'customer_request' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GetRecoveryCaseUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('GetRecoveryCaseUseCase', () => {
  let recoveryRepository: any;
  let sut: GetRecoveryCaseUseCase;

  beforeEach(() => {
    recoveryRepository = { findCaseById: jest.fn() };
    sut = new GetRecoveryCaseUseCase(recoveryRepository);
  });

  it('should throw EntityNotFoundException with caseId in message when case is not found', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', caseId: 'case-xyz' }),
    ).rejects.toThrow('case-xyz');
  });

  it('should return the full case record including all optional populated fields', async () => {
    const richCase = makeCase({
      debtorCompanyName: 'Empresa SA',
      chargeTitle: 'Fatura ago',
      suggestedReply: 'Posso ajudar',
      suggestedNextAction: 'Enviar link',
      guidanceGeneratedAt: new Date('2030-08-01T10:00:00.000Z'),
      lastContactedAt: new Date('2030-07-30T08:00:00.000Z'),
      nextActionAt: new Date('2030-08-05T14:00:00.000Z'),
      paymentReference: 'recovery|tenant-1|case-1',
      assignedTags: ['atraso-30d', 'importacao'],
    });
    recoveryRepository.findCaseById.mockResolvedValue(richCase);

    const result = await sut.execute({ tenantId: 'tenant-1', caseId: 'case-1' });

    expect(result.suggestedReply).toBe('Posso ajudar');
    expect(result.suggestedNextAction).toBe('Enviar link');
    expect(result.guidanceGeneratedAt).toBeInstanceOf(Date);
    expect(result.assignedTags).toEqual(['atraso-30d', 'importacao']);
    expect(result.paymentReference).toBe('recovery|tenant-1|case-1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ListRecoveryCasesUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('ListRecoveryCasesUseCase', () => {
  let recoveryRepository: any;
  let sut: ListRecoveryCasesUseCase;

  beforeEach(() => {
    recoveryRepository = { listCases: jest.fn() };
    sut = new ListRecoveryCasesUseCase(recoveryRepository);
  });

  it('should return an empty array when no cases match the given filters', async () => {
    recoveryRepository.listCases.mockResolvedValue([]);
    const result = await sut.execute({ tenantId: 'tenant-1', status: 'PAID' });
    expect(result).toEqual([]);
  });

  it('should forward dateFrom and dateTo to the repository unchanged', async () => {
    const dateFrom = new Date('2030-01-01');
    const dateTo = new Date('2030-12-31');
    recoveryRepository.listCases.mockResolvedValue([]);

    await sut.execute({ tenantId: 'tenant-1', dateFrom, dateTo });

    expect(recoveryRepository.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom, dateTo }),
    );
  });

  it('should not throw when dateFrom is after dateTo (repository concern)', async () => {
    recoveryRepository.listCases.mockResolvedValue([]);
    await expect(
      sut.execute({ tenantId: 'tenant-1', dateFrom: new Date('2030-12-31'), dateTo: new Date('2030-01-01') }),
    ).resolves.toEqual([]);
  });

  it('should pass branchId filter to the repository', async () => {
    recoveryRepository.listCases.mockResolvedValue([]);
    await sut.execute({ tenantId: 'tenant-1', branchId: 'branch-99' });
    expect(recoveryRepository.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch-99' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GenerateRecoveryReportUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('GenerateRecoveryReportUseCase', () => {
  let recoveryRepository: any;
  let sut: GenerateRecoveryReportUseCase;

  function makeCaseWithStatus(status: string, amountDue: string | null = '100.00', overrides: any = {}): any {
    return makeCase({ status, amountDue, ...overrides });
  }

  beforeEach(() => {
    recoveryRepository = { listCases: jest.fn() };
    sut = new GenerateRecoveryReportUseCase(recoveryRepository);
  });

  it('should count openCases correctly excluding PAID and STOPPED', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeCaseWithStatus('READY_TO_CONTACT'),
      makeCaseWithStatus('CONTACTED'),
      makeCaseWithStatus('PAID'),
      makeCaseWithStatus('STOPPED'),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.openCases).toBe(2);
  });

  it('should include STOPPED cases in totalCases but not openCases', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeCaseWithStatus('STOPPED'),
      makeCaseWithStatus('READY_TO_CONTACT'),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.totalCases).toBe(2);
    expect(result.summary.openCases).toBe(1);
  });

  it('should count CANCELLED status in totalCases but not openCases or paidCases', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeCaseWithStatus('CANCELLED'),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.totalCases).toBe(1);
    expect(result.summary.openCases).toBe(0);
    expect(result.summary.paidCases).toBe(0);
  });

  it('should count INVALID_CONTACT in totalCases but not openCases', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeCaseWithStatus('INVALID_CONTACT'),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.totalCases).toBe(1);
    expect(result.summary.openCases).toBe(0);
  });

  it('should count FAILED_RECURRING in totalCases but not openCases', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeCaseWithStatus('FAILED_RECURRING'),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.totalCases).toBe(1);
    expect(result.summary.openCases).toBe(0);
  });

  it('should not break openAmount or paidAmount when amountDue is null', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeCaseWithStatus('CONTACTED', null),
      makeCaseWithStatus('PAID', null),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.openAmount).toBe(0);
    expect(result.summary.paidAmount).toBe(0);
  });

  it('should sum openAmount only from non-PAID non-STOPPED cases', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeCaseWithStatus('CONTACTED', '50.00'),
      makeCaseWithStatus('NEGOTIATING', '75.50'),
      makeCaseWithStatus('PAID', '120.00'),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.openAmount).toBeCloseTo(125.5);
    expect(result.summary.paidAmount).toBeCloseTo(120.0);
  });

  it('should return all cases when search string is empty', async () => {
    const cases = [makeCaseWithStatus('CONTACTED'), makeCaseWithStatus('PAID')];
    recoveryRepository.listCases.mockResolvedValue(cases);

    const result = await sut.execute({ tenantId: 'tenant-1', search: '' });

    expect(result.summary.totalCases).toBe(2);
  });

  it('should filter by debtorCompanyName in search', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeCase({ debtorCompanyName: 'Academia Forma', debtorName: 'João' }),
      makeCase({ id: 'case-2', debtorCompanyName: 'Clinica Norte', debtorName: 'Maria' }),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1', search: 'academia' });

    expect(result.summary.totalCases).toBe(1);
    expect(result.items[0].debtorCompanyName).toBe('Academia Forma');
  });

  it('should filter by chargeTitle in search', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeCase({ chargeTitle: 'Mensalidade Jul', debtorName: 'Ana' }),
      makeCase({ id: 'case-2', chargeTitle: 'Consulta Médica', debtorName: 'Pedro' }),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1', search: 'mensalidade' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].chargeTitle).toBe('Mensalidade Jul');
  });

  it('should filter by externalReference in search', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeCase({ externalReference: 'ERP-100', debtorName: 'Roberto' }),
      makeCase({ id: 'case-2', externalReference: 'ERP-200', debtorName: 'Sandra' }),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1', search: 'ERP-100' });

    expect(result.items).toHaveLength(1);
  });

  it('should pass dateFrom and dateTo to the repository', async () => {
    const dateFrom = new Date('2030-01-01');
    const dateTo = new Date('2030-06-30');
    recoveryRepository.listCases.mockResolvedValue([]);

    await sut.execute({ tenantId: 'tenant-1', dateFrom, dateTo });

    expect(recoveryRepository.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom, dateTo }),
    );
  });

  it('should include generatedAt timestamp in the output', async () => {
    recoveryRepository.listCases.mockResolvedValue([]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('should count guidanceCases for cases with a suggestedReply', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeCase({ suggestedReply: 'Reply text', status: 'NEGOTIATING' }),
      makeCase({ id: 'case-2', suggestedReply: null, status: 'CONTACTED' }),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.guidanceCases).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CreateRecoveryPlaybookUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('CreateRecoveryPlaybookUseCase', () => {
  let playbookRepository: any;
  let sut: CreateRecoveryPlaybookUseCase;

  beforeEach(() => {
    playbookRepository = { createPlaybook: jest.fn() };
    sut = new CreateRecoveryPlaybookUseCase(playbookRepository);
  });

  it('should throw ValidationErrorException when phases array is empty', async () => {
    await expect(
      sut.execute({ tenantId: 'tenant-1', name: 'Playbook', phases: [] }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });

  it('should throw ValidationErrorException when phases is undefined', async () => {
    await expect(
      sut.execute({ tenantId: 'tenant-1', name: 'Playbook', phases: undefined as any }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });

  it('should throw ValidationErrorException when a TEMPLATE phase has empty templateBody', async () => {
    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        name: 'Playbook',
        phases: [{ sortOrder: 0, mode: 'TEMPLATE', templateBody: '' }],
      }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });

  it('should throw ValidationErrorException when a TEMPLATE phase has whitespace-only templateBody', async () => {
    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        name: 'Playbook',
        phases: [{ sortOrder: 0, mode: 'TEMPLATE', templateBody: '   ' }],
      }),
    ).rejects.toBeInstanceOf(ValidationErrorException);
  });

  it('should succeed for an AI phase without templateBody', async () => {
    const created = {
      playbook: { id: 'pb-1', tenantId: 'tenant-1', name: 'Playbook', active: false, isSystem: false, version: 1, branchId: null, createdAt: new Date(), updatedAt: new Date() },
      phases: [{ id: 'phase-1', playbookId: 'pb-1', sortOrder: 0, channel: 'WHATSAPP', mode: 'AI', templateBody: null, minDelayHoursSincePrevious: 0, minDaysOverdue: 0 }],
    };
    playbookRepository.createPlaybook.mockResolvedValue(created);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      name: 'Playbook AI',
      phases: [{ sortOrder: 0, mode: 'AI' }],
    });

    expect(result.playbook.id).toBe('pb-1');
    expect(playbookRepository.createPlaybook).toHaveBeenCalledOnce();
  });

  it('should succeed for a TEMPLATE phase with valid templateBody', async () => {
    const created = {
      playbook: { id: 'pb-2', tenantId: 'tenant-1', name: 'Playbook', active: false, isSystem: false, version: 1, branchId: null, createdAt: new Date(), updatedAt: new Date() },
      phases: [],
    };
    playbookRepository.createPlaybook.mockResolvedValue(created);

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        name: 'Playbook Template',
        phases: [{ sortOrder: 0, mode: 'TEMPLATE', templateBody: 'Oi {{debtorName}}' }],
      }),
    ).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ActivateRecoveryPlaybookUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('ActivateRecoveryPlaybookUseCase', () => {
  let playbookRepository: any;
  let sut: ActivateRecoveryPlaybookUseCase;

  beforeEach(() => {
    playbookRepository = {
      findPlaybookWithPhases: jest.fn(),
      activatePlaybook: jest.fn(),
    };
    sut = new ActivateRecoveryPlaybookUseCase(playbookRepository);
  });

  it('should throw EntityNotFoundException when playbook is not found', async () => {
    playbookRepository.findPlaybookWithPhases.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', playbookId: 'missing-pb' }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should throw EntityNotFoundException containing the playbookId', async () => {
    playbookRepository.findPlaybookWithPhases.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', playbookId: 'pb-unknown' }),
    ).rejects.toThrow('pb-unknown');
  });

  it('should return null when playbook belongs to another tenant (returns null from repository)', async () => {
    playbookRepository.findPlaybookWithPhases.mockResolvedValue(null);

    const result = await sut.execute({ tenantId: 'tenant-B', playbookId: 'pb-1' }).catch(() => null);
    expect(result).toBeNull();
  });

  it('should delegate to activatePlaybook when playbook is found', async () => {
    playbookRepository.findPlaybookWithPhases.mockResolvedValue({
      playbook: { id: 'pb-1', tenantId: 'tenant-1', active: false, isSystem: false, name: 'Test', version: 1, branchId: null, createdAt: new Date(), updatedAt: new Date() },
      phases: [],
    });
    const activated = { id: 'pb-1', active: true };
    playbookRepository.activatePlaybook.mockResolvedValue(activated);

    const result = await sut.execute({ tenantId: 'tenant-1', playbookId: 'pb-1' });

    expect(playbookRepository.activatePlaybook).toHaveBeenCalledWith('tenant-1', 'pb-1');
    expect(result).toEqual(activated);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ListRecoveryPlaybooksUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('ListRecoveryPlaybooksUseCase', () => {
  let playbookRepository: any;
  let sut: ListRecoveryPlaybooksUseCase;

  beforeEach(() => {
    playbookRepository = {
      ensureSystemDefaultPlaybook: jest.fn().mockResolvedValue(null),
      listPlaybooks: jest.fn(),
      listPhases: jest.fn(),
    };
    sut = new ListRecoveryPlaybooksUseCase(playbookRepository);
  });

  it('should ensure default playbook before listing', async () => {
    playbookRepository.listPlaybooks.mockResolvedValue([]);

    await sut.execute({ tenantId: 'tenant-1' });

    expect(playbookRepository.ensureSystemDefaultPlaybook).toHaveBeenCalledWith('tenant-1');
  });

  it('should return empty array when no playbooks exist', async () => {
    playbookRepository.listPlaybooks.mockResolvedValue([]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result).toEqual([]);
  });

  it('should load phases for each playbook', async () => {
    const pb = { id: 'pb-1', tenantId: 'tenant-1', name: 'Test', active: true, isSystem: false, version: 1, branchId: null, createdAt: new Date(), updatedAt: new Date() };
    playbookRepository.listPlaybooks.mockResolvedValue([pb]);
    const phases = [{ id: 'phase-1', playbookId: 'pb-1', sortOrder: 0, mode: 'AI', templateBody: null, channel: 'WHATSAPP', minDelayHoursSincePrevious: 0, minDaysOverdue: 0 }];
    playbookRepository.listPhases.mockResolvedValue(phases);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result).toHaveLength(1);
    expect(result[0].playbook.id).toBe('pb-1');
    expect(result[0].phases).toEqual(phases);
    expect(playbookRepository.listPhases).toHaveBeenCalledWith('pb-1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ListRecoveryRecurringChargesUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('ListRecoveryRecurringChargesUseCase', () => {
  let recurringChargeRepository: any;
  let sut: ListRecoveryRecurringChargesUseCase;

  beforeEach(() => {
    recurringChargeRepository = { listByCase: jest.fn() };
    sut = new ListRecoveryRecurringChargesUseCase(recurringChargeRepository);
  });

  it('should call listByCase with tenantId and caseId', async () => {
    recurringChargeRepository.listByCase.mockResolvedValue([]);

    await sut.execute({ tenantId: 'tenant-1', caseId: 'case-1' });

    expect(recurringChargeRepository.listByCase).toHaveBeenCalledWith('tenant-1', 'case-1');
  });

  it('should return empty array when no recurring charges exist for the case', async () => {
    recurringChargeRepository.listByCase.mockResolvedValue([]);

    const result = await sut.execute({ tenantId: 'tenant-1', caseId: 'case-1' });

    expect(result).toEqual([]);
  });

  it('should return all recurring charges for the case', async () => {
    const charges = [makeRecurrence(), makeRecurrence({ id: 'rec-2', status: 'COMPLETED' })];
    recurringChargeRepository.listByCase.mockResolvedValue(charges);

    const result = await sut.execute({ tenantId: 'tenant-1', caseId: 'case-1' });

    expect(result).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SeedDefaultRecoveryPlaybookUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('SeedDefaultRecoveryPlaybookUseCase', () => {
  let playbookRepository: any;
  let sut: SeedDefaultRecoveryPlaybookUseCase;

  beforeEach(() => {
    playbookRepository = {
      ensureSystemDefaultPlaybook: jest.fn(),
      findActivePlaybookWithPhases: jest.fn(),
    };
    sut = new SeedDefaultRecoveryPlaybookUseCase(playbookRepository);
  });

  it('should return seeded=true with the new playbook when no playbook existed', async () => {
    const newPlaybook = {
      playbook: { id: 'pb-default', active: true, isSystem: true, name: 'Padrao sistema', tenantId: 'tenant-1', version: 1, branchId: null, createdAt: new Date(), updatedAt: new Date() },
      phases: [],
    };
    playbookRepository.ensureSystemDefaultPlaybook.mockResolvedValue(newPlaybook);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.seeded).toBe(true);
    expect(result.playbook).toBe(newPlaybook);
  });

  it('should return seeded=false when a playbook already existed (idempotent call)', async () => {
    playbookRepository.ensureSystemDefaultPlaybook.mockResolvedValue(null);
    const existing = {
      playbook: { id: 'pb-existing', active: true, isSystem: true, name: 'Padrao sistema', tenantId: 'tenant-1', version: 1, branchId: null, createdAt: new Date(), updatedAt: new Date() },
      phases: [],
    };
    playbookRepository.findActivePlaybookWithPhases.mockResolvedValue(existing);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.seeded).toBe(false);
    expect(result.playbook).toBe(existing);
  });

  it('should not call ensureSystemDefaultPlaybook twice (idempotency check)', async () => {
    const newPlaybook = {
      playbook: { id: 'pb-default', active: true, isSystem: true, name: 'Padrao', tenantId: 'tenant-1', version: 1, branchId: null, createdAt: new Date(), updatedAt: new Date() },
      phases: [],
    };
    playbookRepository.ensureSystemDefaultPlaybook.mockResolvedValue(newPlaybook);

    await sut.execute({ tenantId: 'tenant-1' });
    await sut.execute({ tenantId: 'tenant-1' });

    // The second call gets null from ensureSystemDefault (already exists)
    expect(playbookRepository.ensureSystemDefaultPlaybook).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// StartRecoveryReportExportUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('StartRecoveryReportExportUseCase', () => {
  let recoveryAsyncJobsService: any;
  let recoveryAsyncQueue: any;
  let sut: StartRecoveryReportExportUseCase;

  const baseJob = {
    id: 'job-1',
    type: 'EXPORT_RECOVERY_REPORT_CSV',
    status: 'QUEUED',
    tenantId: 'tenant-1',
    createdAt: new Date(),
  };

  beforeEach(() => {
    recoveryAsyncJobsService = {
      createJob: jest.fn().mockResolvedValue(baseJob),
      attachQueueJobId: jest.fn().mockResolvedValue(undefined),
      failJob: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn().mockResolvedValue(baseJob),
    };
    recoveryAsyncQueue = {
      add: jest.fn().mockResolvedValue({ id: 'queue-job-1' }),
    };
    sut = new StartRecoveryReportExportUseCase(recoveryAsyncJobsService, recoveryAsyncQueue);
  });

  it('should create an async job and queue it', async () => {
    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(recoveryAsyncJobsService.createJob).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', type: 'EXPORT_RECOVERY_REPORT_CSV' }),
    );
    expect(recoveryAsyncQueue.add).toHaveBeenCalledWith(
      'export-recovery-report-csv',
      expect.objectContaining({ tenantId: 'tenant-1' }),
      expect.any(Object),
    );
    expect(result.type).toBe('EXPORT_RECOVERY_REPORT_CSV');
  });

  it('should forward branchId to the queue payload', async () => {
    await sut.execute({ tenantId: 'tenant-1', branchId: 'branch-99' });

    expect(recoveryAsyncQueue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ branchId: 'branch-99' }),
      expect.any(Object),
    );
  });

  it('should trim whitespace-only search to undefined', async () => {
    await sut.execute({ tenantId: 'tenant-1', search: '   ' });

    expect(recoveryAsyncQueue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ search: undefined }),
      expect.any(Object),
    );
  });

  it('should fail the job and rethrow when the queue.add throws', async () => {
    recoveryAsyncQueue.add.mockRejectedValue(new Error('Queue unavailable'));

    await expect(
      sut.execute({ tenantId: 'tenant-1' }),
    ).rejects.toThrow('Queue unavailable');

    expect(recoveryAsyncJobsService.failJob).toHaveBeenCalledWith('job-1', 'Queue unavailable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RecoveryPaymentEventHandler
// ─────────────────────────────────────────────────────────────────────────────

describe('RecoveryPaymentEventHandler', () => {
  let eventBus: any;
  let recoveryRepository: any;
  let recurringChargeRepository: any;
  let sut: RecoveryPaymentEventHandler;
  let subscribedCallback: (event: any) => Promise<void>;

  beforeEach(() => {
    subscribedCallback = undefined as any;
    eventBus = {
      subscribe: jest.fn((eventName: string, cb: any) => {
        subscribedCallback = cb;
      }),
      publish: jest.fn(),
    };
    recoveryRepository = {
      findCaseByPaymentReference: jest.fn(),
      updateCaseStatus: jest.fn(),
    };
    recurringChargeRepository = {
      cancelActiveByCase: jest.fn(),
    };
    sut = new RecoveryPaymentEventHandler(eventBus, recoveryRepository, recurringChargeRepository);
    sut.onModuleInit();
  });

  it('should subscribe to the payment.confirmed event on init', () => {
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'payment.confirmed',
      expect.any(Function),
      expect.objectContaining({ consumerName: 'recovery-payment-confirmed' }),
    );
  });

  it('should silently skip when rawReference is not a recovery reference', async () => {
    await subscribedCallback({
      payload: { tenantId: 'tenant-1', rawReference: 'subscription|tenant-1|sub-1', confirmedAt: new Date().toISOString() },
    });

    expect(recoveryRepository.findCaseByPaymentReference).not.toHaveBeenCalled();
  });

  it('should silently skip when tenantId in reference mismatches the event payload tenantId', async () => {
    await subscribedCallback({
      payload: { tenantId: 'tenant-B', rawReference: 'recovery|tenant-A|case-1', confirmedAt: new Date().toISOString() },
    });

    expect(recoveryRepository.findCaseByPaymentReference).not.toHaveBeenCalled();
  });

  it('should silently skip when case is not found for payment reference', async () => {
    recoveryRepository.findCaseByPaymentReference.mockResolvedValue(null);

    await subscribedCallback({
      payload: { tenantId: 'tenant-1', rawReference: 'recovery|tenant-1|case-1', confirmedAt: new Date().toISOString() },
    });

    expect(recoveryRepository.updateCaseStatus).not.toHaveBeenCalled();
  });

  it('should silently skip when case is already PAID', async () => {
    recoveryRepository.findCaseByPaymentReference.mockResolvedValue(makeCase({ status: 'PAID' }));

    await subscribedCallback({
      payload: { tenantId: 'tenant-1', rawReference: 'recovery|tenant-1|case-1', confirmedAt: new Date().toISOString() },
    });

    expect(recoveryRepository.updateCaseStatus).not.toHaveBeenCalled();
  });

  it('should update status to PAID and cancel active recurring charges on valid payment', async () => {
    recoveryRepository.findCaseByPaymentReference.mockResolvedValue(makeCase({ status: 'CONTACTED' }));
    recoveryRepository.updateCaseStatus.mockResolvedValue(makeCase({ status: 'PAID' }));
    recurringChargeRepository.cancelActiveByCase.mockResolvedValue(1);

    const confirmedAt = '2030-08-10T12:00:00.000Z';
    await subscribedCallback({
      payload: { tenantId: 'tenant-1', rawReference: 'recovery|tenant-1|case-1', confirmedAt },
    });

    expect(recoveryRepository.updateCaseStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PAID', paidAt: new Date(confirmedAt) }),
    );
    expect(recurringChargeRepository.cancelActiveByCase).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', caseId: 'case-1', reason: 'payment_confirmed' }),
    );
  });

  it('should propagate error if updateCaseStatus throws', async () => {
    recoveryRepository.findCaseByPaymentReference.mockResolvedValue(makeCase({ status: 'CONTACTED' }));
    recoveryRepository.updateCaseStatus.mockRejectedValue(new Error('DB error'));

    await expect(
      subscribedCallback({
        payload: { tenantId: 'tenant-1', rawReference: 'recovery|tenant-1|case-1', confirmedAt: new Date().toISOString() },
      }),
    ).rejects.toThrow('DB error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RecoveryRecurringChargeDueHandler
// ─────────────────────────────────────────────────────────────────────────────

describe('RecoveryRecurringChargeDueHandler', () => {
  let eventBus: any;
  let processUseCase: any;
  let sut: RecoveryRecurringChargeDueHandler;
  let subscribedCallback: (event: any) => Promise<void>;
  let capturedOptions: any;

  beforeEach(() => {
    subscribedCallback = undefined as any;
    capturedOptions = undefined;
    eventBus = {
      subscribe: jest.fn((eventName: string, cb: any, opts: any) => {
        subscribedCallback = cb;
        capturedOptions = opts;
      }),
    };
    processUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
    sut = new RecoveryRecurringChargeDueHandler(eventBus, processUseCase);
    sut.onModuleInit();
  });

  it('should subscribe to recovery.recurring-charge.due on init', () => {
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'recovery.recurring-charge.due',
      expect.any(Function),
      expect.any(Object),
    );
  });

  it('should subscribe with consumerName recovery-recurring-charge-due', () => {
    expect(capturedOptions.consumerName).toBe('recovery-recurring-charge-due');
  });

  it('should subscribe with concurrency=5', () => {
    expect(capturedOptions.concurrency).toBe(5);
  });

  it('should forward tenantId and recurrenceId to the use case', async () => {
    await subscribedCallback({
      payload: { tenantId: 'tenant-1', recurrenceId: 'rec-99' },
    });

    expect(processUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      recurrenceId: 'rec-99',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RecoveryMessageReceivedHandler — error paths
// ─────────────────────────────────────────────────────────────────────────────

describe('RecoveryMessageReceivedHandler — error paths', () => {
  let eventBus: any;
  let registerReplyUseCase: any;
  let sut: RecoveryMessageReceivedHandler;
  let subscribedCallback: (event: any) => Promise<void>;

  beforeEach(() => {
    subscribedCallback = undefined as any;
    eventBus = {
      subscribe: jest.fn((_, cb: any) => {
        subscribedCallback = cb;
      }),
    };
    registerReplyUseCase = { execute: jest.fn() };
    sut = new RecoveryMessageReceivedHandler(eventBus, registerReplyUseCase);
    sut.onModuleInit();
  });

  it('should propagate error when RegisterRecoveryReplyUseCase.execute throws', async () => {
    registerReplyUseCase.execute.mockRejectedValue(new Error('unexpected'));

    await expect(
      subscribedCallback({
        payload: { tenantId: 'tenant-1', contactId: 'contact-1', content: { text: 'mensagem' } },
      }),
    ).rejects.toThrow('unexpected');
  });

  it('should pass undefined messageText when payload content.text is missing', async () => {
    registerReplyUseCase.execute.mockResolvedValue(undefined);

    await subscribedCallback({
      payload: { tenantId: 'tenant-1', contactId: 'contact-1', content: {} },
    });

    expect(registerReplyUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ messageText: undefined }),
    );
  });

  it('should pass undefined messageText when payload content is missing entirely', async () => {
    registerReplyUseCase.execute.mockResolvedValue(undefined);

    await subscribedCallback({
      payload: { tenantId: 'tenant-1', contactId: 'contact-1' },
    });

    expect(registerReplyUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ messageText: undefined }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RecoveryReportCsvBuilder
// ─────────────────────────────────────────────────────────────────────────────

describe('RecoveryReportCsvBuilder', () => {
  let sut: RecoveryReportCsvBuilder;

  function makeReport(items: any[] = []): any {
    return {
      generatedAt: new Date(),
      summary: { totalCases: items.length, openCases: 0, promiseCases: 0, paidCases: 0, guidanceCases: 0, openAmount: 0, paidAmount: 0 },
      items,
    };
  }

  function makeItem(overrides: Partial<any> = {}): any {
    return {
      ...makeCase(overrides),
    };
  }

  beforeEach(() => {
    sut = new RecoveryReportCsvBuilder();
  });

  it('should produce a CSV with a header row as the first line', () => {
    const { content } = sut.build(makeReport([]));
    const firstLine = content.split('\n')[0];
    expect(firstLine).toContain('Devedor');
    expect(firstLine).toContain('Status');
    expect(firstLine).toContain('Valor');
  });

  it('should include all 17 header columns', () => {
    const { content } = sut.build(makeReport([]));
    const headerCells = content.split('\n')[0].split(';');
    expect(headerCells).toHaveLength(17);
  });

  it('should correctly escape double-quotes in debtor name', () => {
    const item = makeItem({ debtorName: 'João "O Devedor"' });
    const { content } = sut.build(makeReport([item]));
    expect(content).toContain('João ""O Devedor""');
  });

  it('should correctly handle semicolons in debtor name without breaking columns', () => {
    const item = makeItem({ debtorName: 'João; Silva' });
    const { content } = sut.build(makeReport([item]));
    // The name should be wrapped in quotes, keeping it in one column
    const dataLine = content.split('\n')[1];
    expect(dataLine).toContain('"João; Silva"');
  });

  it('should produce empty string columns for null optional fields', () => {
    const item = makeItem({ debtorCompanyName: null, chargeTitle: null, amountDue: null });
    const { content } = sut.build(makeReport([item]));
    const dataLine = content.split('\n')[1];
    // debtorCompanyName column should be ""
    expect(dataLine).toContain('""');
  });

  it('should use mimeType text/csv;charset=utf-8', () => {
    const { mimeType } = sut.build(makeReport([]));
    expect(mimeType).toBe('text/csv;charset=utf-8');
  });

  it('should include debtorName and phone in the data rows', () => {
    const item = makeItem({ debtorName: 'Patricia', phone: '5511999990001' });
    const { content } = sut.build(makeReport([item]));
    expect(content).toContain('Patricia');
    expect(content).toContain('5511999990001');
  });

  it('should include the paidAt ISO string when set', () => {
    const paidAt = new Date('2030-08-10T12:00:00.000Z');
    const item = makeItem({ paidAt, status: 'PAID' });
    const { content } = sut.build(makeReport([item]));
    expect(content).toContain('2030-08-10T12:00:00.000Z');
  });

  it('should produce empty paidAt column when paidAt is null', () => {
    const item = makeItem({ paidAt: null });
    const { content } = sut.build(makeReport([item]));
    const dataLine = content.split('\n')[1];
    // paidAt is the 15th column (0-indexed 14), should be ""
    expect(dataLine.split(';')[14]).toBe('""');
  });

  it('should include tags joined by comma', () => {
    const item = makeItem({ assignedTags: ['atraso-30d', 'importacao'] });
    const { content } = sut.build(makeReport([item]));
    expect(content).toContain('atraso-30d, importacao');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AIRecoveryOutreachGenerator — error & edge paths
// ─────────────────────────────────────────────────────────────────────────────

describe('AIRecoveryOutreachGenerator — error and edge paths', () => {
  let aiEngine: any;
  let sut: AIRecoveryOutreachGenerator;

  beforeEach(() => {
    aiEngine = { generateResponse: jest.fn() };
    sut = new AIRecoveryOutreachGenerator(aiEngine);
  });

  it('should fall back to deterministic message when AI throws an exception', async () => {
    aiEngine.generateResponse.mockRejectedValue(new Error('AI service down'));

    const result = await sut.generate({
      tenantId: 'tenant-1',
      debtorName: 'Ana',
      chargeTitle: 'Mensalidade Jul',
      amountDue: '99.90',
      assignedTags: [],
    });

    expect(result).toContain('Ana');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });

  it('should fall back to deterministic message when AI returns empty string', async () => {
    aiEngine.generateResponse.mockResolvedValue({ text: '', tokensUsed: 0, confidence: 0, finishReason: 'stop' });

    const result = await sut.generate({
      tenantId: 'tenant-1',
      debtorName: 'Carlos',
      chargeTitle: null,
      assignedTags: [],
    });

    expect(result).toContain('Carlos');
  });

  it('should fall back to deterministic message when AI returns whitespace-only text', async () => {
    aiEngine.generateResponse.mockResolvedValue({ text: '   ', tokensUsed: 0, confidence: 0, finishReason: 'stop' });

    const result = await sut.generate({
      tenantId: 'tenant-1',
      debtorName: 'Pedro',
      assignedTags: [],
    });

    expect(result).toContain('Pedro');
  });

  it('should return AI text directly when valid and non-empty', async () => {
    aiEngine.generateResponse.mockResolvedValue({
      text: 'Oi, teste. Regularize sua pendência.',
      tokensUsed: 20,
      confidence: 0.9,
      finishReason: 'stop',
    });

    const result = await sut.generate({
      tenantId: 'tenant-1',
      debtorName: 'Teste',
      assignedTags: [],
    });

    expect(result).toBe('Oi, teste. Regularize sua pendência.');
  });

  it('should include company name in fallback when debtorCompanyName is provided', async () => {
    aiEngine.generateResponse.mockRejectedValue(new Error('fail'));

    const result = await sut.generate({
      tenantId: 'tenant-1',
      debtorName: 'Luiza',
      debtorCompanyName: 'Studio Pilates',
      assignedTags: [],
    });

    expect(result).toContain('Studio Pilates');
  });

  it('should include amountDue in fallback text when provided', async () => {
    aiEngine.generateResponse.mockRejectedValue(new Error('fail'));

    const result = await sut.generate({
      tenantId: 'tenant-1',
      debtorName: 'Mario',
      amountDue: '250.00',
      assignedTags: [],
    });

    expect(result).toContain('250');
  });
});

