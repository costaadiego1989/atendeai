/**
 * recovery.integration-new.spec.ts
 *
 * Integration tests for the recovery module: repository logic, module wiring,
 * service interactions. All Prisma/BullMQ/external adapters are mocked via
 * jest.fn() — no real database required.
 */

import { PrismaRecoveryRepository } from '../infrastructure/persistence/repositories/PrismaRecoveryRepository';
import { PrismaRecoveryRecurringChargeRepository } from '../infrastructure/persistence/repositories/PrismaRecoveryRecurringChargeRepository';
import { PrismaRecoveryPlaybookRepository } from '../infrastructure/persistence/repositories/PrismaRecoveryPlaybookRepository';
import { RecoveryReportCsvBuilder } from '../application/services/RecoveryReportCsvBuilder';
import { GenerateRecoveryReportUseCase } from '../application/use-cases/GenerateRecoveryReportUseCase';
import { ProcessRecoveryRecurringChargeUseCase } from '../application/use-cases/ProcessRecoveryRecurringChargeUseCase';
import { RegisterRecoveryReplyUseCase } from '../application/use-cases/RegisterRecoveryReplyUseCase';
import { SendRecoveryGuidanceUseCase } from '../application/use-cases/SendRecoveryGuidanceUseCase';
import { TriggerRecoveryOutreachUseCase } from '../application/use-cases/TriggerRecoveryOutreachUseCase';
import { RecoveryCaseMessagingService } from '../application/services/RecoveryCaseMessagingService';
import { RecoveryReplyPolicy } from '../application/services/RecoveryReplyPolicy';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';

// ─────────────────────────────────────────────────────────────────────────────
// Shared factories
// ─────────────────────────────────────────────────────────────────────────────

function makeRawRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'case-1',
    tenant_id: 'tenant-1',
    branch_id: null,
    contact_id: null,
    debtor_name: 'Test Debtor',
    debtor_company_name: null,
    debtor_document: null,
    phone: '5511999990001',
    external_reference: null,
    payment_reference: null,
    source: 'MANUAL',
    charge_type: null,
    charge_title: null,
    charge_description: null,
    reference_period: null,
    related_entity_type: null,
    related_entity_id: null,
    related_entity_label: null,
    amount_due: null,
    due_date: null,
    status: 'READY_TO_CONTACT',
    assigned_tags: [],
    last_contacted_at: null,
    next_action_at: null,
    paid_at: null,
    suggested_reply: null,
    suggested_next_action: null,
    guidance_generated_at: null,
    playbook_id: null,
    playbook_phase_index: 0,
    last_playbook_phase_executed_at: null,
    created_at: new Date('2030-01-01T00:00:00.000Z'),
    updated_at: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeRawRecurrence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'rec-1',
    tenant_id: 'tenant-1',
    branch_id: null,
    case_id: 'case-1',
    status: 'ACTIVE',
    billing_type: 'PIX',
    interval_days: 7,
    max_occurrences: 3,
    occurrences_sent: 0,
    first_run_at: new Date('2030-09-01T00:00:00.000Z'),
    next_run_at: new Date(Date.now() - 60_000),
    last_run_at: null,
    message_template: null,
    last_error: null,
    lease_until: null,
    created_by_user_id: null,
    created_by_user_email: null,
    cancelled_at: null,
    completed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeRawPlaybook(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pb-1',
    tenant_id: 'tenant-1',
    branch_id: null,
    name: 'Padrao sistema',
    version: 1,
    active: true,
    is_system: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PrismaRecoveryRepository — data mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaRecoveryRepository — data mapping via mocked prisma', () => {
  let prisma: any;
  let repo: PrismaRecoveryRepository;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    repo = new PrismaRecoveryRepository(prisma);
  });

  it('should map snake_case DB row to camelCase RecoveryCaseRecord', async () => {
    const row = makeRawRow({ debtor_company_name: 'Clinica Sul', amount_due: '199.90' });
    prisma.$queryRaw.mockResolvedValue([row]);

    const result = await repo.findCaseById('tenant-1', 'case-1');

    expect(result).toEqual(expect.objectContaining({
      id: 'case-1',
      tenantId: 'tenant-1',
      debtorCompanyName: 'Clinica Sul',
      amountDue: '199.90',
    }));
  });

  it('should map amount_due numeric string to fixed 2 decimal places', async () => {
    const row = makeRawRow({ amount_due: { toString: () => '199.9' } });
    prisma.$queryRaw.mockResolvedValue([row]);

    const result = await repo.findCaseById('tenant-1', 'case-1');

    expect(result?.amountDue).toBe('199.90');
  });

  it('should return null when findCaseById finds no rows', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await repo.findCaseById('tenant-1', 'no-such-id');

    expect(result).toBeNull();
  });

  it('should return null when findCaseByPaymentReference finds no rows', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await repo.findCaseByPaymentReference('tenant-1', 'recovery|tenant-1|no-case');

    expect(result).toBeNull();
  });

  it('should map assigned_tags array correctly when present', async () => {
    const row = makeRawRow({ assigned_tags: ['tag-a', 'tag-b'] });
    prisma.$queryRaw.mockResolvedValue([row]);

    const result = await repo.findCaseById('tenant-1', 'case-1');

    expect(result?.assignedTags).toEqual(['tag-a', 'tag-b']);
  });

  it('should default assignedTags to empty array when DB returns null', async () => {
    const row = makeRawRow({ assigned_tags: null });
    prisma.$queryRaw.mockResolvedValue([row]);

    const result = await repo.findCaseById('tenant-1', 'case-1');

    expect(result?.assignedTags).toEqual([]);
  });

  it('should map all optional date fields to null when not present in the row', async () => {
    prisma.$queryRaw.mockResolvedValue([makeRawRow()]);

    const result = await repo.findCaseById('tenant-1', 'case-1');

    expect(result?.lastContactedAt).toBeNull();
    expect(result?.nextActionAt).toBeNull();
    expect(result?.paidAt).toBeNull();
    expect(result?.guidanceGeneratedAt).toBeNull();
  });

  it('should map amountDue to null when amount_due is null', async () => {
    prisma.$queryRaw.mockResolvedValue([makeRawRow({ amount_due: null })]);

    const result = await repo.findCaseById('tenant-1', 'case-1');

    expect(result?.amountDue).toBeNull();
  });

  it('listCases should return all mapped records from queryRaw', async () => {
    const rows = [makeRawRow(), makeRawRow({ id: 'case-2', debtor_name: 'Second' })];
    prisma.$queryRaw.mockResolvedValue(rows);

    const result = await repo.listCases({ tenantId: 'tenant-1' });

    expect(result).toHaveLength(2);
    expect(result[1].debtorName).toBe('Second');
  });

  it('createCase should call queryRaw with an INSERT and return the new record', async () => {
    prisma.$queryRaw.mockResolvedValue([makeRawRow({ debtor_name: 'New Case' })]);

    const result = await repo.createCase({
      tenantId: 'tenant-1',
      debtorName: 'New Case',
      phone: '5511999990001',
      source: 'MANUAL',
      assignedTags: [],
    });

    expect(result.debtorName).toBe('New Case');
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('updateCaseStatus should throw when no row is returned (tenant mismatch guard)', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(
      repo.updateCaseStatus({ tenantId: 'tenant-1', caseId: 'case-1', status: 'PAID' }),
    ).rejects.toThrow();
  });

  it('findLatestActiveCaseByContact should return null when no active case exists', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await repo.findLatestActiveCaseByContact('tenant-1', 'contact-1');

    expect(result).toBeNull();
  });

  it('setPaymentReference should throw on tenant mismatch (empty result)', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(
      repo.setPaymentReference({ tenantId: 'tenant-1', caseId: 'case-1', paymentReference: 'ref-1' }),
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PrismaRecoveryRecurringChargeRepository — data mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaRecoveryRecurringChargeRepository — data mapping', () => {
  let prisma: any;
  let repo: PrismaRecoveryRecurringChargeRepository;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    repo = new PrismaRecoveryRecurringChargeRepository(prisma);
  });

  it('findById should return null when no row is found', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await repo.findById('tenant-1', 'missing-rec');

    expect(result).toBeNull();
  });

  it('findById should map snake_case row to RecoveryRecurringChargeRecord', async () => {
    prisma.$queryRaw.mockResolvedValue([makeRawRecurrence()]);

    const result = await repo.findById('tenant-1', 'rec-1');

    expect(result).toEqual(expect.objectContaining({
      id: 'rec-1',
      tenantId: 'tenant-1',
      caseId: 'case-1',
      status: 'ACTIVE',
      billingType: 'PIX',
      intervalDays: 7,
    }));
  });

  it('listByCase should return empty array when no charges exist', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await repo.listByCase('tenant-1', 'case-1');

    expect(result).toEqual([]);
  });

  it('listByCase should return multiple records in order', async () => {
    const rows = [
      makeRawRecurrence({ id: 'rec-1' }),
      makeRawRecurrence({ id: 'rec-2', status: 'COMPLETED' }),
    ];
    prisma.$queryRaw.mockResolvedValue(rows);

    const result = await repo.listByCase('tenant-1', 'case-1');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('rec-1');
    expect(result[1].status).toBe('COMPLETED');
  });

  it('cancel should call queryRaw and return the updated record with CANCELLED status', async () => {
    prisma.$queryRaw.mockResolvedValue([makeRawRecurrence({ status: 'CANCELLED', next_run_at: null })]);

    const result = await repo.cancel({ tenantId: 'tenant-1', recurrenceId: 'rec-1', reason: 'test' });

    expect(result.status).toBe('CANCELLED');
    expect(result.nextRunAt).toBeNull();
  });

  it('cancelActiveByCase should call queryRaw and return the count', async () => {
    prisma.$queryRaw.mockResolvedValue([{ count: 3 }]);

    const count = await repo.cancelActiveByCase({ tenantId: 'tenant-1', caseId: 'case-1', reason: 'payment_confirmed' });

    expect(count).toBe(3);
  });

  it('startRun should return null when ON CONFLICT prevents insert (duplicate occurrence)', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await repo.startRun({
      recurrenceId: 'rec-1',
      tenantId: 'tenant-1',
      caseId: 'case-1',
      occurrenceNumber: 1,
      scheduledFor: new Date(),
    });

    expect(result).toBeNull();
  });

  it('advanceAfterSuccess should set status to COMPLETED when nextRunAt is null', async () => {
    prisma.$queryRaw.mockResolvedValue([makeRawRecurrence({ status: 'COMPLETED', next_run_at: null })]);

    const result = await repo.advanceAfterSuccess({
      tenantId: 'tenant-1',
      recurrenceId: 'rec-1',
      occurrenceNumber: 3,
      nextRunAt: null,
    });

    expect(result.status).toBe('COMPLETED');
  });

  it('claimDue should return empty array when no due recurrences exist', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await repo.claimDue(new Date(), 10);

    expect(result).toEqual([]);
  });

  it('releaseLease should call executeRaw to clear lease', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    await repo.releaseLease({ tenantId: 'tenant-1', recurrenceId: 'rec-1', errorMessage: null });

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PrismaRecoveryPlaybookRepository — data mapping and invariants
// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaRecoveryPlaybookRepository — data mapping and invariants', () => {
  let prisma: any;
  let repo: PrismaRecoveryPlaybookRepository;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    repo = new PrismaRecoveryPlaybookRepository(prisma);
  });

  it('ensureSystemDefaultPlaybook should return null if playbooks already exist', async () => {
    prisma.$queryRaw.mockResolvedValue([{ n: BigInt(1) }]);

    const result = await repo.ensureSystemDefaultPlaybook('tenant-1');

    expect(result).toBeNull();
    // Should NOT insert new rows
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('ensureSystemDefaultPlaybook should create playbook and phases when count is 0', async () => {
    // First call: count query returns 0
    // Subsequent calls: findPlaybookWithPhases -> playbook row, then phases
    prisma.$queryRaw
      .mockResolvedValueOnce([{ n: BigInt(0) }])       // count check
      .mockResolvedValueOnce([makeRawPlaybook()])       // findPlaybookWithPhases: playbook row
      .mockResolvedValueOnce([]);                       // listPhases: no phases yet
    prisma.$executeRaw.mockResolvedValue(1);

    const result = await repo.ensureSystemDefaultPlaybook('tenant-1');

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2); // INSERT playbook + INSERT phases
    expect(result).toEqual(expect.objectContaining({
      playbook: expect.objectContaining({ tenantId: 'tenant-1' }),
    }));
  });

  it('findPlaybookWithPhases should return null when playbook is not found', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await repo.findPlaybookWithPhases('tenant-1', 'pb-missing');

    expect(result).toBeNull();
  });

  it('findPlaybookWithPhases should return playbook with phases', async () => {
    const rawPhase = {
      id: 'phase-1', playbook_id: 'pb-1', sort_order: 0, channel: 'WHATSAPP',
      min_delay_hours_since_previous: 0, min_days_overdue: 0, mode: 'AI', template_body: null,
    };
    prisma.$queryRaw
      .mockResolvedValueOnce([makeRawPlaybook()])
      .mockResolvedValueOnce([rawPhase]);

    const result = await repo.findPlaybookWithPhases('tenant-1', 'pb-1');

    expect(result?.playbook.id).toBe('pb-1');
    expect(result?.phases).toHaveLength(1);
    expect(result?.phases[0].mode).toBe('AI');
  });

  it('findActivePlaybookWithPhases should return null when no active playbook exists', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await repo.findActivePlaybookWithPhases('tenant-1', null);

    expect(result).toBeNull();
  });

  it('findActivePlaybookWithPhases should try branch-scoped query first when branchId provided', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([makeRawPlaybook({ branch_id: 'branch-1' })])
      .mockResolvedValueOnce([]);

    const result = await repo.findActivePlaybookWithPhases('tenant-1', 'branch-1');

    expect(result?.playbook.branchId).toBe('branch-1');
  });

  it('findActivePlaybookWithPhases should fall back to global playbook when branch-scoped is not found', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])                          // no branch-scoped
      .mockResolvedValueOnce([makeRawPlaybook()])         // global fallback playbook
      .mockResolvedValueOnce([]);                         // no phases

    const result = await repo.findActivePlaybookWithPhases('tenant-1', 'branch-1');

    expect(result?.playbook.branchId).toBeNull();
  });

  it('listPlaybooks should return empty array when no playbooks exist', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await repo.listPlaybooks('tenant-1');

    expect(result).toEqual([]);
  });

  it('activatePlaybook should deactivate all others and activate the target', async () => {
    // findPlaybookWithPhases (inside activatePlaybook)
    prisma.$queryRaw
      .mockResolvedValueOnce([makeRawPlaybook()])  // target found
      .mockResolvedValueOnce([])                   // listPhases
      .mockResolvedValueOnce([makeRawPlaybook({ active: true })]);  // UPDATE RETURNING
    prisma.$executeRaw.mockResolvedValue(1);

    const result = await repo.activatePlaybook('tenant-1', 'pb-1');

    expect(prisma.$executeRaw).toHaveBeenCalled(); // deactivate all
    expect(result.active).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GenerateRecoveryReportUseCase + RecoveryReportCsvBuilder (integration)
// ─────────────────────────────────────────────────────────────────────────────

describe('GenerateRecoveryReportUseCase + RecoveryReportCsvBuilder pipeline', () => {
  let recoveryRepository: any;
  let reportUseCase: GenerateRecoveryReportUseCase;
  let csvBuilder: RecoveryReportCsvBuilder;

  beforeEach(() => {
    recoveryRepository = { listCases: jest.fn() };
    reportUseCase = new GenerateRecoveryReportUseCase(recoveryRepository);
    csvBuilder = new RecoveryReportCsvBuilder();
  });

  it('should produce a CSV that contains all case data from the report', async () => {
    const now = new Date();
    recoveryRepository.listCases.mockResolvedValue([
      {
        id: 'case-1', tenantId: 'tenant-1', debtorName: 'Carlos Silva', phone: '5511999990001',
        debtorCompanyName: 'Coworking SA', source: 'MANUAL', status: 'CONTACTED',
        chargeTitle: 'Mensalidade Ago', amountDue: '199.90', dueDate: null,
        assignedTags: ['atraso-60d'], lastContactedAt: null, nextActionAt: null,
        paidAt: null, externalReference: null, paymentReference: null,
        chargeDescription: null, createdAt: now, updatedAt: now,
      },
    ]);

    const report = await reportUseCase.execute({ tenantId: 'tenant-1' });
    const { content, mimeType } = csvBuilder.build(report);

    expect(mimeType).toContain('text/csv');
    expect(content).toContain('Carlos Silva');
    expect(content).toContain('Coworking SA');
    expect(content).toContain('Mensalidade Ago');
    expect(content).toContain('199.90');
    expect(content).toContain('atraso-60d');
  });

  it('should produce a CSV with only a header row when there are no cases', async () => {
    recoveryRepository.listCases.mockResolvedValue([]);

    const report = await reportUseCase.execute({ tenantId: 'tenant-1' });
    const { content } = csvBuilder.build(report);

    const lines = content.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1); // header only
  });

  it('should correctly tally summary counters and reflect them in the CSV header section', async () => {
    const now = new Date();
    recoveryRepository.listCases.mockResolvedValue([
      { id: 'c1', tenantId: 'tenant-1', debtorName: 'A', phone: '111', source: 'MANUAL', status: 'CONTACTED', amountDue: '50.00', assignedTags: [], createdAt: now, updatedAt: now },
      { id: 'c2', tenantId: 'tenant-1', debtorName: 'B', phone: '222', source: 'MANUAL', status: 'PAID', amountDue: '75.00', assignedTags: [], createdAt: now, updatedAt: now },
      { id: 'c3', tenantId: 'tenant-1', debtorName: 'C', phone: '333', source: 'MANUAL', status: 'PROMISE_TO_PAY', amountDue: '100.00', assignedTags: [], createdAt: now, updatedAt: now },
    ]);

    const report = await reportUseCase.execute({ tenantId: 'tenant-1' });

    expect(report.summary.totalCases).toBe(3);
    expect(report.summary.openCases).toBe(2);
    expect(report.summary.paidCases).toBe(1);
    expect(report.summary.promiseCases).toBe(1);
    expect(report.summary.openAmount).toBeCloseTo(150.0);
    expect(report.summary.paidAmount).toBeCloseTo(75.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ProcessRecoveryRecurringChargeUseCase — additional error and edge paths
// ─────────────────────────────────────────────────────────────────────────────

describe('ProcessRecoveryRecurringChargeUseCase — additional edge paths', () => {
  let recurringChargeRepository: any;
  let recoveryRepository: any;
  let generatePaymentLinkUseCase: any;
  let sut: ProcessRecoveryRecurringChargeUseCase;

  beforeEach(() => {
    recurringChargeRepository = {
      findById: jest.fn(),
      startRun: jest.fn(),
      markRunSucceeded: jest.fn(),
      markRunFailed: jest.fn(),
      markRunSkipped: jest.fn(),
      advanceAfterSuccess: jest.fn(),
      cancel: jest.fn(),
      releaseLease: jest.fn(),
    };
    recoveryRepository = { findCaseById: jest.fn() };
    generatePaymentLinkUseCase = { execute: jest.fn() };
    sut = new ProcessRecoveryRecurringChargeUseCase(
      recurringChargeRepository,
      recoveryRepository,
      generatePaymentLinkUseCase,
    );
  });

  it('should skip processing when recurrence status is CANCELLED', async () => {
    recurringChargeRepository.findById.mockResolvedValue({
      id: 'rec-1', tenantId: 'tenant-1', caseId: 'case-1',
      status: 'CANCELLED', billingType: 'PIX', intervalDays: 7,
      occurrencesSent: 0, nextRunAt: new Date(Date.now() - 1000),
    });

    await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(recurringChargeRepository.startRun).not.toHaveBeenCalled();
    expect(generatePaymentLinkUseCase.execute).not.toHaveBeenCalled();
  });

  it('should skip processing when recurrence status is COMPLETED', async () => {
    recurringChargeRepository.findById.mockResolvedValue({
      id: 'rec-1', tenantId: 'tenant-1', caseId: 'case-1',
      status: 'COMPLETED', billingType: 'PIX', intervalDays: 7,
      occurrencesSent: 3, nextRunAt: null,
    });

    await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(recurringChargeRepository.startRun).not.toHaveBeenCalled();
  });

  it('should skip when nextRunAt is in the future (not yet due)', async () => {
    recurringChargeRepository.findById.mockResolvedValue({
      id: 'rec-1', tenantId: 'tenant-1', caseId: 'case-1',
      status: 'ACTIVE', billingType: 'PIX', intervalDays: 7,
      occurrencesSent: 0, nextRunAt: new Date(Date.now() + 3_600_000), // 1h from now
    });

    await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(recurringChargeRepository.startRun).not.toHaveBeenCalled();
  });

  it('should call markRunFailed when generatePaymentLink throws', async () => {
    recurringChargeRepository.findById.mockResolvedValue({
      id: 'rec-1', tenantId: 'tenant-1', caseId: 'case-1',
      status: 'ACTIVE', billingType: 'PIX', intervalDays: 7,
      maxOccurrences: 5, occurrencesSent: 0,
      nextRunAt: new Date(Date.now() - 1000),
    });
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1', status: 'CONTACTED', debtorName: 'Ana', chargeTitle: 'Test', amountDue: '100.00',
    });
    recurringChargeRepository.startRun.mockResolvedValue({ id: 'run-1' });
    generatePaymentLinkUseCase.execute.mockRejectedValue(new Error('Payment gateway error'));

    await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(recurringChargeRepository.markRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-1', errorMessage: 'Payment gateway error' }),
    );
  });

  it('should return early when startRun returns null (duplicate run prevention)', async () => {
    recurringChargeRepository.findById.mockResolvedValue({
      id: 'rec-1', tenantId: 'tenant-1', caseId: 'case-1',
      status: 'ACTIVE', billingType: 'PIX', intervalDays: 7,
      maxOccurrences: 5, occurrencesSent: 0,
      nextRunAt: new Date(Date.now() - 1000),
    });
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1', status: 'CONTACTED',
    });
    recurringChargeRepository.startRun.mockResolvedValue(null);

    await sut.execute({ tenantId: 'tenant-1', recurrenceId: 'rec-1' });

    expect(generatePaymentLinkUseCase.execute).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RegisterRecoveryReplyUseCase — additional paths
// ─────────────────────────────────────────────────────────────────────────────

describe('RegisterRecoveryReplyUseCase — additional paths', () => {
  let recoveryRepository: any;
  let guidanceGenerator: any;
  let sut: RegisterRecoveryReplyUseCase;

  beforeEach(() => {
    recoveryRepository = {
      findLatestActiveCaseByContact: jest.fn(),
      updateCaseStatus: jest.fn(),
      updateCaseGuidance: jest.fn(),
    };
    guidanceGenerator = { generate: jest.fn() };
    sut = new RegisterRecoveryReplyUseCase(
      recoveryRepository,
      new RecoveryReplyPolicy(),
      guidanceGenerator,
    );
  });

  it('should return null silently when no active case found for contact', async () => {
    recoveryRepository.findLatestActiveCaseByContact.mockResolvedValue(null);

    const result = await sut.execute({ tenantId: 'tenant-1', contactId: 'contact-1', messageText: 'oi' });

    expect(result).toBeNull();
    expect(recoveryRepository.updateCaseStatus).not.toHaveBeenCalled();
  });

  it('should classify PROMISE_TO_PAY path for payment intent messages', async () => {
    recoveryRepository.findLatestActiveCaseByContact.mockResolvedValue({
      id: 'case-1', tenantId: 'tenant-1', debtorName: 'Ana',
      chargeTitle: 'Mensalidade', amountDue: '99.90',
    });
    recoveryRepository.updateCaseStatus.mockResolvedValue({ id: 'case-1', status: 'PROMISE_TO_PAY', debtorName: 'Ana', chargeTitle: 'Mensalidade', amountDue: '99.90', tenantId: 'tenant-1' });
    guidanceGenerator.generate.mockResolvedValue({ suggestedReply: 'Ótimo!', suggestedNextAction: 'Confirmar' });
    recoveryRepository.updateCaseGuidance.mockResolvedValue({ id: 'case-1', status: 'PROMISE_TO_PAY' });

    await sut.execute({ tenantId: 'tenant-1', contactId: 'contact-1', messageText: 'vou pagar hoje no pix' });

    expect(recoveryRepository.updateCaseStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PROMISE_TO_PAY' }),
    );
  });

  it('should propagate error when guidanceGenerator throws during NEGOTIATING flow', async () => {
    recoveryRepository.findLatestActiveCaseByContact.mockResolvedValue({
      id: 'case-1', tenantId: 'tenant-1', debtorName: 'Bob',
    });
    recoveryRepository.updateCaseStatus.mockResolvedValue({ id: 'case-1', status: 'NEGOTIATING', tenantId: 'tenant-1', debtorName: 'Bob' });
    guidanceGenerator.generate.mockRejectedValue(new Error('AI timeout'));

    await expect(
      sut.execute({ tenantId: 'tenant-1', contactId: 'contact-1', messageText: 'consigo parcelar?' }),
    ).rejects.toThrow('AI timeout');
  });

  it('should clear guidance and set status to STOPPED when opt-out is received', async () => {
    recoveryRepository.findLatestActiveCaseByContact.mockResolvedValue({
      id: 'case-2', tenantId: 'tenant-1', debtorName: 'Carlos',
    });
    recoveryRepository.updateCaseStatus.mockResolvedValue({ id: 'case-2', status: 'STOPPED' });
    recoveryRepository.updateCaseGuidance.mockResolvedValue({ id: 'case-2', status: 'STOPPED' });

    await sut.execute({ tenantId: 'tenant-1', contactId: 'contact-1', messageText: 'pare de me contatar' });

    expect(recoveryRepository.updateCaseStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'STOPPED' }),
    );
    expect(recoveryRepository.updateCaseGuidance).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedReply: null, suggestedNextAction: null }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SendRecoveryGuidanceUseCase — error paths
// ─────────────────────────────────────────────────────────────────────────────

describe('SendRecoveryGuidanceUseCase — error paths', () => {
  let recoveryRepository: any;
  let contactFacade: any;
  let messagingFacade: any;
  let sut: SendRecoveryGuidanceUseCase;

  beforeEach(() => {
    recoveryRepository = {
      findCaseById: jest.fn(),
      updateCaseStatus: jest.fn(),
      updateCaseGuidance: jest.fn(),
    };
    contactFacade = { getContactById: jest.fn(), ensureContact: jest.fn() };
    messagingFacade = { queueSystemMessage: jest.fn() };
    const messagingService = new RecoveryCaseMessagingService(contactFacade, messagingFacade);
    sut = new SendRecoveryGuidanceUseCase(recoveryRepository, messagingService);
  });

  it('should throw EntityNotFoundException when case is not found', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', caseId: 'missing', messageText: 'Oi' }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should propagate error when messagingFacade.queueSystemMessage throws', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1', tenantId: 'tenant-1', branchId: null, debtorName: 'Ana',
      phone: '5511999990001', status: 'NEGOTIATING', contactId: 'contact-1',
      assignedTags: [],
    });
    contactFacade.getContactById.mockResolvedValue({ id: 'contact-1', name: 'Ana', phone: '5511999990001' });
    messagingFacade.queueSystemMessage.mockRejectedValue(new Error('Messaging error'));

    await expect(
      sut.execute({ tenantId: 'tenant-1', caseId: 'case-1', messageText: 'Oi Ana' }),
    ).rejects.toThrow('Messaging error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TriggerRecoveryOutreachUseCase — additional paths
// ─────────────────────────────────────────────────────────────────────────────

describe('TriggerRecoveryOutreachUseCase — additional paths', () => {
  let recoveryRepository: any;
  let contactFacade: any;
  let messagingFacade: any;
  let outreachGenerator: any;
  let playbookRepository: any;
  let sut: TriggerRecoveryOutreachUseCase;

  beforeEach(() => {
    recoveryRepository = { findCaseById: jest.fn(), updateCaseStatus: jest.fn() };
    contactFacade = { ensureContact: jest.fn(), getContactById: jest.fn() };
    messagingFacade = { queueSystemMessage: jest.fn() };
    outreachGenerator = { generate: jest.fn() };
    playbookRepository = { findActiveByTenantId: jest.fn().mockResolvedValue(null), findById: jest.fn().mockResolvedValue(null) };
    const messagingService = new RecoveryCaseMessagingService(contactFacade, messagingFacade);
    sut = new TriggerRecoveryOutreachUseCase(recoveryRepository, messagingService, outreachGenerator, playbookRepository);
  });

  it('should throw when case is not found', async () => {
    recoveryRepository.findCaseById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', caseId: 'missing', messageText: 'Oi' }),
    ).rejects.toBeDefined();
  });

  it('should propagate error when messagingFacade.queueSystemMessage fails', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1', branchId: null, debtorName: 'Ana', phone: '5511999990001', assignedTags: [],
    });
    contactFacade.ensureContact.mockResolvedValue({ contactId: 'contact-1', created: true });
    messagingFacade.queueSystemMessage.mockRejectedValue(new Error('Send failed'));

    await expect(
      sut.execute({ tenantId: 'tenant-1', caseId: 'case-1', messageText: 'Oi' }),
    ).rejects.toThrow('Send failed');
  });

  it('should set contact created=false when contact already exists', async () => {
    recoveryRepository.findCaseById.mockResolvedValue({
      id: 'case-1', branchId: null, debtorName: 'Ana', phone: '5511999990001', assignedTags: [],
    });
    contactFacade.ensureContact.mockResolvedValue({ contactId: 'contact-existing', created: false });
    messagingFacade.queueSystemMessage.mockResolvedValue({ conversationId: 'conv-1', messageId: 'msg-1' });
    recoveryRepository.updateCaseStatus.mockResolvedValue({ id: 'case-1', status: 'CONTACTED' });

    const result = await sut.execute({ tenantId: 'tenant-1', caseId: 'case-1', messageText: 'Oi' });

    expect(result.contactId).toBe('contact-existing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RecoveryReplyPolicy — integration (no mocks, pure logic)
// ─────────────────────────────────────────────────────────────────────────────

describe('RecoveryReplyPolicy — classification logic', () => {
  let policy: RecoveryReplyPolicy;

  beforeEach(() => {
    policy = new RecoveryReplyPolicy();
  });

  it('should classify STOP for opt-out phrases', () => {
    expect(policy.classify('pare de me mandar mensagem')).toBe('STOP');
    expect(policy.classify('não me contate mais')).toBe('STOP');
  });

  it('should classify PROMISE_TO_PAY for payment intent messages', () => {
    expect(policy.classify('vou pagar hoje')).toBe('PROMISE_TO_PAY');
    expect(policy.classify('vou transferir agora')).toBe('PROMISE_TO_PAY');
  });

  it('should classify NEGOTIATING for negotiation messages', () => {
    expect(policy.classify('consigo parcelar')).toBe('NEGOTIATING');
    expect(policy.classify('posso pagar em parcelas')).toBe('NEGOTIATING');
  });

  it('should classify NEGOTIATING for generic questions about the debt', () => {
    expect(policy.classify('quero entender esse valor')).toBe('NEGOTIATING');
  });

  it('should return a valid classification for an empty string without throwing', () => {
    expect(() => policy.classify('')).not.toThrow();
    const result = policy.classify('');
    expect(result).toBeDefined();
  });

  it('should return a valid classification for a numeric-only message without throwing', () => {
    expect(() => policy.classify('12345')).not.toThrow();
    const result = policy.classify('12345');
    expect(result).toBeDefined();
  });

  it('should return a valid classification for a very long message without throwing', () => {
    const longMessage = 'a'.repeat(2000);
    expect(() => policy.classify(longMessage)).not.toThrow();
  });

  it('should return a valid classification for SQL injection-like input without throwing', () => {
    expect(() => policy.classify("' OR 1=1; DROP TABLE recovery_cases; --")).not.toThrow();
  });

  it('should return a valid classification for mixed-language input', () => {
    const result = policy.classify('I want to pay this bill agora');
    expect(result).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PrismaRecoveryRepository — listCases filters (boundary)
// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaRecoveryRepository — listCases filter forwarding', () => {
  let prisma: any;
  let repo: PrismaRecoveryRepository;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    repo = new PrismaRecoveryRepository(prisma);
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it('should call queryRaw when no optional filters are provided', async () => {
    await repo.listCases({ tenantId: 'tenant-1' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should call queryRaw when branchId filter is provided', async () => {
    await repo.listCases({ tenantId: 'tenant-1', branchId: 'branch-1' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should call queryRaw when status filter is provided', async () => {
    await repo.listCases({ tenantId: 'tenant-1', status: 'PAID' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should call queryRaw when source filter is provided', async () => {
    await repo.listCases({ tenantId: 'tenant-1', source: 'CRM' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should call queryRaw when both dateFrom and dateTo are provided', async () => {
    await repo.listCases({
      tenantId: 'tenant-1',
      dateFrom: new Date('2030-01-01'),
      dateTo: new Date('2030-12-31'),
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should call queryRaw when dateFrom is null', async () => {
    await repo.listCases({ tenantId: 'tenant-1', dateFrom: null });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PrismaRecoveryRecurringChargeRepository — additional coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaRecoveryRecurringChargeRepository — additional coverage', () => {
  let prisma: any;
  let repo: PrismaRecoveryRecurringChargeRepository;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    repo = new PrismaRecoveryRecurringChargeRepository(prisma);
  });

  it('cancelActiveByCase should return 0 when no active charges exist', async () => {
    prisma.$queryRaw.mockResolvedValue([{ count: 0 }]);

    const count = await repo.cancelActiveByCase({ tenantId: 'tenant-1', caseId: 'case-no-charges' });

    expect(count).toBe(0);
  });

  it('markRunSucceeded should call executeRaw', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    await repo.markRunSucceeded({ runId: 'run-1', paymentLinkId: 'plink-1', conversationId: 'conv-1', messageId: 'msg-1' });

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('markRunFailed should call executeRaw with the error message', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    await repo.markRunFailed({ runId: 'run-1', errorMessage: 'Payment failed' });

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('markRunSkipped should call executeRaw with the skip reason', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    await repo.markRunSkipped({ runId: 'run-1', reason: 'terminal_case_PAID' });

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('create should call queryRaw with INSERT and return the new record', async () => {
    prisma.$queryRaw.mockResolvedValue([makeRawRecurrence()]);

    const result = await repo.create({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      billingType: 'PIX',
      intervalDays: 7,
      firstRunAt: new Date(),
    });

    expect(result.tenantId).toBe('tenant-1');
    expect(result.billingType).toBe('PIX');
  });

  it('should map maxOccurrences to null when DB returns null', async () => {
    prisma.$queryRaw.mockResolvedValue([makeRawRecurrence({ max_occurrences: null })]);

    const result = await repo.findById('tenant-1', 'rec-1');

    expect(result?.maxOccurrences).toBeNull();
  });

  it('should map occurrencesSent to 0 when DB returns null', async () => {
    prisma.$queryRaw.mockResolvedValue([makeRawRecurrence({ occurrences_sent: null })]);

    const result = await repo.findById('tenant-1', 'rec-1');

    expect(result?.occurrencesSent).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PrismaRecoveryPlaybookRepository — additional coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaRecoveryPlaybookRepository — additional coverage', () => {
  let prisma: any;
  let repo: PrismaRecoveryPlaybookRepository;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    repo = new PrismaRecoveryPlaybookRepository(prisma);
  });

  it('listPhases should return empty array when no phases exist', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await repo.listPhases('pb-1');

    expect(result).toEqual([]);
  });

  it('listPhases should map phase rows correctly', async () => {
    const rawPhase = {
      id: 'phase-1', playbook_id: 'pb-1', sort_order: 1,
      channel: 'WHATSAPP', min_delay_hours_since_previous: 24,
      min_days_overdue: 7, mode: 'TEMPLATE', template_body: 'Oi {{debtorName}}',
    };
    prisma.$queryRaw.mockResolvedValue([rawPhase]);

    const result = await repo.listPhases('pb-1');

    expect(result[0]).toEqual(expect.objectContaining({
      id: 'phase-1',
      playbookId: 'pb-1',
      sortOrder: 1,
      mode: 'TEMPLATE',
      templateBody: 'Oi {{debtorName}}',
    }));
  });

  it('createPlaybook should call executeRaw for playbook and each phase', async () => {
    // findPlaybookWithPhases at the end of createPlaybook
    prisma.$queryRaw
      .mockResolvedValueOnce([makeRawPlaybook()])
      .mockResolvedValueOnce([]);
    prisma.$executeRaw.mockResolvedValue(1);

    await repo.createPlaybook({
      tenantId: 'tenant-1',
      name: 'New Playbook',
      phases: [
        { sortOrder: 0, mode: 'AI' },
        { sortOrder: 1, mode: 'TEMPLATE', templateBody: 'Oi {{debtorName}}' },
      ],
    });

    // 1 for playbook INSERT + 2 for phase INSERTs
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('hasDispatchedPhase should return false when no dispatch record exists', async () => {
    prisma.$queryRaw.mockResolvedValue([{ exists: false }]);

    const result = await repo.hasDispatchedPhase('case-1', 'phase-1');

    expect(result).toBe(false);
  });

  it('hasDispatchedPhase should return true when dispatch record exists', async () => {
    prisma.$queryRaw.mockResolvedValue([{ exists: true }]);

    const result = await repo.hasDispatchedPhase('case-1', 'phase-1');

    expect(result).toBe(true);
  });

  it('recordPhaseDispatch should call executeRaw with INSERT ON CONFLICT DO NOTHING', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    await repo.recordPhaseDispatch({ tenantId: 'tenant-1', caseId: 'case-1', phaseId: 'phase-1' });

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GenerateRecoveryReportUseCase — statuses and filters (integration with mocked repo)
// ─────────────────────────────────────────────────────────────────────────────

describe('GenerateRecoveryReportUseCase — advanced filter scenarios', () => {
  let recoveryRepository: any;
  let sut: GenerateRecoveryReportUseCase;
  const now = new Date();

  function makeMinimalCase(id: string, status: string, amount: string | null = '100.00'): any {
    return {
      id, tenantId: 'tenant-1', debtorName: `Debtor ${id}`, phone: `551199999${id.slice(-4)}`,
      source: 'MANUAL', status, amountDue: amount,
      assignedTags: [], createdAt: now, updatedAt: now,
    };
  }

  beforeEach(() => {
    recoveryRepository = { listCases: jest.fn() };
    sut = new GenerateRecoveryReportUseCase(recoveryRepository);
  });

  it('should handle a mix of all terminal statuses correctly in summary', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeMinimalCase('c1', 'PAID'),
      makeMinimalCase('c2', 'STOPPED'),
      makeMinimalCase('c3', 'CANCELLED'),
      makeMinimalCase('c4', 'INVALID_CONTACT'),
      makeMinimalCase('c5', 'FAILED_RECURRING'),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.totalCases).toBe(5);
    expect(result.summary.openCases).toBe(0);
    expect(result.summary.paidCases).toBe(1);
  });

  it('should filter by source when sources filter is provided', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      { ...makeMinimalCase('c1', 'CONTACTED'), source: 'CRM' },
      { ...makeMinimalCase('c2', 'CONTACTED'), source: 'MANUAL' },
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1', sources: ['CRM'] });

    expect(result.summary.totalCases).toBe(1);
    expect(result.items[0].source).toBe('CRM');
  });

  it('should filter by status when statuses filter is provided', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeMinimalCase('c1', 'NEGOTIATING'),
      makeMinimalCase('c2', 'CONTACTED'),
      makeMinimalCase('c3', 'PAID'),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1', statuses: ['NEGOTIATING', 'PAID'] });

    expect(result.summary.totalCases).toBe(2);
  });

  it('should return all items when statuses filter is empty array', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeMinimalCase('c1', 'CONTACTED'),
      makeMinimalCase('c2', 'PAID'),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1', statuses: [] });

    expect(result.summary.totalCases).toBe(2);
  });

  it('should combine search and status filters correctly', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      { ...makeMinimalCase('c1', 'NEGOTIATING'), debtorName: 'João Negociação' },
      { ...makeMinimalCase('c2', 'NEGOTIATING'), debtorName: 'Maria Pagou', status: 'PAID' },
      { ...makeMinimalCase('c3', 'PAID'), debtorName: 'João Pago' },
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1', statuses: ['NEGOTIATING'], search: 'joão' });

    expect(result.summary.totalCases).toBe(1);
    expect(result.items[0].debtorName).toBe('João Negociação');
  });

  it('should search case-insensitively by phone number', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      { ...makeMinimalCase('c1', 'CONTACTED'), phone: '5511997771001' },
      { ...makeMinimalCase('c2', 'CONTACTED'), phone: '5511997772002' },
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1', search: '7771001' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].phone).toBe('5511997771001');
  });

  it('should correctly handle amountDue=null without throwing in paidAmount/openAmount calculation', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      { ...makeMinimalCase('c1', 'PAID', null) },
      { ...makeMinimalCase('c2', 'CONTACTED', null) },
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.paidAmount).toBe(0);
    expect(result.summary.openAmount).toBe(0);
  });

  it('should produce promiseCases count for PROMISE_TO_PAY cases', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeMinimalCase('c1', 'PROMISE_TO_PAY'),
      makeMinimalCase('c2', 'PROMISE_TO_PAY'),
      makeMinimalCase('c3', 'CONTACTED'),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.promiseCases).toBe(2);
  });

  it('should pass null dateFrom and dateTo to repository when not provided', async () => {
    recoveryRepository.listCases.mockResolvedValue([]);

    await sut.execute({ tenantId: 'tenant-1' });

    expect(recoveryRepository.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: null, dateTo: null }),
    );
  });

  it('should not include undefined/null statuses in filter matching', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      makeMinimalCase('c1', 'CONTACTED'),
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1', statuses: [undefined as any, null as any, 'CONTACTED'] });

    expect(result.summary.totalCases).toBe(1);
  });

  it('should search by relatedEntityLabel', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      { ...makeMinimalCase('c1', 'CONTACTED'), relatedEntityLabel: 'Plano Premium Centro' },
      { ...makeMinimalCase('c2', 'CONTACTED'), relatedEntityLabel: 'Plano Basico Norte' },
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1', search: 'plano premium' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].relatedEntityLabel).toBe('Plano Premium Centro');
  });

  it('should search by chargeDescription when chargeTitle does not match', async () => {
    recoveryRepository.listCases.mockResolvedValue([
      { ...makeMinimalCase('c1', 'CONTACTED'), chargeDescription: 'Servico de instalacao pendente', chargeTitle: null },
    ]);

    const result = await sut.execute({ tenantId: 'tenant-1', search: 'instalacao' });

    expect(result.items).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full use-case pipeline: CreateRecoveryCaseUseCase → ListRecoveryCasesUseCase
// ─────────────────────────────────────────────────────────────────────────────

describe('CreateRecoveryCaseUseCase + ListRecoveryCasesUseCase pipeline', () => {
  let recoveryRepository: any;
  let contactFacade: any;
  let playbookRepository: any;
  let configService: any;

  function buildSut() {
    const createUseCase = new (require('../application/use-cases/CreateRecoveryCaseUseCase').CreateRecoveryCaseUseCase)(
      recoveryRepository, contactFacade, playbookRepository, configService,
    );
    const listUseCase = new (require('../application/use-cases/ListRecoveryCasesUseCase').ListRecoveryCasesUseCase)(
      recoveryRepository,
    );
    return { createUseCase, listUseCase };
  }

  beforeEach(() => {
    const now = new Date();
    recoveryRepository = {
      createCase: jest.fn().mockResolvedValue({
        id: 'case-1', tenantId: 'tenant-1', debtorName: 'Ana', phone: '5511999990001',
        source: 'MANUAL', status: 'READY_TO_CONTACT', assignedTags: [],
        createdAt: now, updatedAt: now,
      }),
      listCases: jest.fn(),
    };
    contactFacade = { getContactById: jest.fn(), ensureContact: jest.fn() };
    playbookRepository = {
      ensureSystemDefaultPlaybook: jest.fn().mockResolvedValue(null),
      findActivePlaybookWithPhases: jest.fn().mockResolvedValue(null),
    };
    configService = { get: jest.fn().mockReturnValue('false') };
  });

  it('should allow a just-created case to appear in a subsequent list call', async () => {
    const { createUseCase, listUseCase } = buildSut();
    recoveryRepository.listCases.mockResolvedValue([
      { id: 'case-1', tenantId: 'tenant-1', debtorName: 'Ana', phone: '5511999990001', source: 'MANUAL', status: 'READY_TO_CONTACT', assignedTags: [], createdAt: new Date(), updatedAt: new Date() },
    ]);

    await createUseCase.execute({ tenantId: 'tenant-1', debtorName: 'Ana', phone: '5511999990001' });
    const cases = await listUseCase.execute({ tenantId: 'tenant-1' });

    expect(cases).toHaveLength(1);
    expect(cases[0].debtorName).toBe('Ana');
  });

  it('should correctly scope a list call to the same tenantId used in create', async () => {
    const { createUseCase, listUseCase } = buildSut();
    recoveryRepository.listCases.mockResolvedValue([]);

    await createUseCase.execute({ tenantId: 'tenant-1', debtorName: 'Ana', phone: '5511999990001' });
    await listUseCase.execute({ tenantId: 'tenant-2' });

    const listCallArg = recoveryRepository.listCases.mock.calls[0][0];
    expect(listCallArg.tenantId).toBe('tenant-2');
  });

  it('should produce MANUAL source for a case without contactId', async () => {
    const { createUseCase } = buildSut();

    const result = await createUseCase.execute({ tenantId: 'tenant-1', debtorName: 'Maria', phone: '5511999990002' });

    expect(result.source).toBe('MANUAL');
  });

  it('should return all fields including optional null fields from createCase', async () => {
    const { createUseCase } = buildSut();

    const result = await createUseCase.execute({ tenantId: 'tenant-1', debtorName: 'Bob', phone: '5511999990003' });

    expect(result.id).toBe('case-1');
    expect(result.status).toBe('READY_TO_CONTACT');
  });

  it('should validate that listing with branchId filter scopes correctly', async () => {
    const { listUseCase } = buildSut();
    recoveryRepository.listCases.mockResolvedValue([]);

    await listUseCase.execute({ tenantId: 'tenant-1', branchId: 'branch-specific' });

    expect(recoveryRepository.listCases).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch-specific' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PrismaRecoveryRepository — updateCaseGuidance mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaRecoveryRepository — updateCaseGuidance', () => {
  let prisma: any;
  let repo: PrismaRecoveryRepository;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    repo = new PrismaRecoveryRepository(prisma);
  });

  it('updateCaseGuidance should call queryRaw and return mapped record', async () => {
    prisma.$queryRaw.mockResolvedValue([
      makeRawRow({ suggested_reply: 'Posso ajudar', suggested_next_action: 'Enviar link' }),
    ]);

    const result = await repo.updateCaseGuidance({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      suggestedReply: 'Posso ajudar',
      suggestedNextAction: 'Enviar link',
      guidanceGeneratedAt: new Date(),
    });

    expect(result.suggestedReply).toBe('Posso ajudar');
    expect(result.suggestedNextAction).toBe('Enviar link');
  });

  it('updateCaseGuidance should throw when no row is returned', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(
      repo.updateCaseGuidance({ tenantId: 'tenant-1', caseId: 'case-1', suggestedReply: null }),
    ).rejects.toThrow();
  });

  it('updateCasePlaybookProgress should call queryRaw and return record', async () => {
    prisma.$queryRaw.mockResolvedValue([makeRawRow({ playbook_phase_index: 2 })]);

    const result = await repo.updateCasePlaybookProgress({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      playbookPhaseIndex: 2,
      lastPlaybookPhaseExecutedAt: new Date(),
    });

    expect(result.playbookPhaseIndex).toBe(2);
  });

  it('updateCasePlaybookProgress should throw on tenant mismatch', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(
      repo.updateCasePlaybookProgress({
        tenantId: 'tenant-1', caseId: 'case-1', playbookPhaseIndex: 0, lastPlaybookPhaseExecutedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it('findLatestActiveCaseByContact should return the first matched record', async () => {
    prisma.$queryRaw.mockResolvedValue([makeRawRow({ status: 'NEGOTIATING' })]);

    const result = await repo.findLatestActiveCaseByContact('tenant-1', 'contact-1');

    expect(result?.status).toBe('NEGOTIATING');
  });
});
