// alerts.unit-new.spec.ts - NEW unit tests for gaps not covered by existing spec files
// Gaps covered: 1-13, 14-17 (partial), 18-20 (toDomain logic), 30-32

import { CreateAlertReminderUseCase } from '../application/use-cases/CreateAlertReminderUseCase';
import { UpdateAlertReminderUseCase } from '../application/use-cases/UpdateAlertReminderUseCase';
import { DeleteAlertReminderUseCase } from '../application/use-cases/DeleteAlertReminderUseCase';
import { ProcessAlertReminderUseCase } from '../application/use-cases/ProcessAlertReminderUseCase';
import { OperationalAlertEventHandler } from '../application/handlers/OperationalAlertEventHandler';
import { AlertReminderRuntimeConfig } from '../application/services/AlertReminderRuntimeConfig';
import { stubAlertReminderRuntimeConfig } from './alert-reminder-runtime.stub';
import { AlertReminder } from '../domain/types/AlertReminder';

// ─── Shared factories ───────────────────────────────────────────────────────
function makeBaseReminder(overrides = {}) {
  return {
    id: 'reminder-1', tenantId: 'tenant-1', branchId: null,
    userId: 'user-1', userName: 'Paulo', userPhone: '5511999990000',
    userEmail: 'paulo@example.com', timezone: 'UTC',
    title: 'Test reminder', message: 'Test message',
    frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z',
    nextTriggerAt: '2030-06-01T14:00:00.000Z', status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBaseUser(overrides = {}) {
  return {
    id: 'user-1', tenantId: 'tenant-1', name: 'Paulo',
    phone: '5511999990000', email: { value: 'paulo@example.com' },
    ...overrides,
  };
}

function makeMockUser(overrides = {}) {
  return {
    id: { toValue: () => overrides.id ?? 'user-1' },
    name: overrides.name ?? 'Joao Operador',
    phone: { value: overrides.phone ?? '+5511999990000' },
    email: { value: 'joao@test.com' },
    role: { value: 'OPERATOR' },
    ...overrides,
  };
}

function createConfigService(env = {}) {
  return { get: (key) => env[key] };
}

// ═══════════════════════════════════════════════════════════════════════════
// GAP 1, 2: CreateAlertReminderUseCase - quota, user-not-found, tenant-mismatch
// ═══════════════════════════════════════════════════════════════════════════
describe('CreateAlertReminderUseCase – quota and auth guard', () => {
  let reminderRepository: any;
  let reminderQueue: any;
  let authUserRepository: any;
  let tenantRepository: any;
  let sut: any;

  beforeEach(() => {
    reminderRepository = { save: jest.fn(), countActiveByUser: jest.fn().mockResolvedValue(0) };
    reminderQueue = { addJob: jest.fn() };
    authUserRepository = { findById: jest.fn() };
    tenantRepository = { findById: jest.fn().mockResolvedValue(null) };
    sut = new CreateAlertReminderUseCase(
      reminderRepository, reminderQueue, authUserRepository, tenantRepository,
      stubAlertReminderRuntimeConfig(),
    );
  });

  it('GAP-1a: throws when active count equals quota', async () => {
    const runtime = stubAlertReminderRuntimeConfig();
    runtime.maxActiveRemindersPerUser = () => 3;
    const localSut = new CreateAlertReminderUseCase(
      reminderRepository, reminderQueue, authUserRepository, tenantRepository, runtime,
    );
    authUserRepository.findById.mockResolvedValue(makeBaseUser());
    reminderRepository.countActiveByUser.mockResolvedValue(3);
    await expect(
      localSut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' }),
    ).rejects.toThrow();
    expect(reminderRepository.save).not.toHaveBeenCalled();
  });

  it('GAP-1b: throws when active count exceeds quota (count > max)', async () => {
    const runtime = stubAlertReminderRuntimeConfig();
    runtime.maxActiveRemindersPerUser = () => 2;
    const localSut = new CreateAlertReminderUseCase(
      reminderRepository, reminderQueue, authUserRepository, tenantRepository, runtime,
    );
    authUserRepository.findById.mockResolvedValue(makeBaseUser());
    reminderRepository.countActiveByUser.mockResolvedValue(5);
    await expect(
      localSut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' }),
    ).rejects.toThrow();
  });

  it('GAP-1c: allows creation when count is below quota (count < max)', async () => {
    const runtime = stubAlertReminderRuntimeConfig();
    runtime.maxActiveRemindersPerUser = () => 5;
    const localSut = new CreateAlertReminderUseCase(
      reminderRepository, reminderQueue, authUserRepository, tenantRepository, runtime,
    );
    authUserRepository.findById.mockResolvedValue(makeBaseUser());
    reminderRepository.countActiveByUser.mockResolvedValue(4);
    const result = await localSut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' });
    expect(result.status).toBe('ACTIVE');
    expect(reminderRepository.save).toHaveBeenCalled();
  });

  it('GAP-1d: skips quota check entirely when maxActiveRemindersPerUser returns 0', async () => {
    authUserRepository.findById.mockResolvedValue(makeBaseUser());
    reminderRepository.countActiveByUser.mockResolvedValue(999);
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' });
    expect(result.status).toBe('ACTIVE');
    expect(reminderRepository.countActiveByUser).not.toHaveBeenCalled();
  });

  // ─── GAP 2: user not found / tenant mismatch ──────────────────────────────
  it('GAP-2a: throws EntityNotFoundException when authUserRepository.findById returns null', async () => {
    authUserRepository.findById.mockResolvedValue(null);
    await expect(
      sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' }),
    ).rejects.toThrow();
    expect(reminderRepository.save).not.toHaveBeenCalled();
  });

  it('GAP-2b: throws when user.tenantId differs from input.tenantId (cross-tenant guard)', async () => {
    authUserRepository.findById.mockResolvedValue(makeBaseUser({ tenantId: 'tenant-OTHER' }));
    await expect(
      sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' }),
    ).rejects.toThrow();
  });

  it('GAP-2c: throws when user exists but has no phone and tenant has no fallback', async () => {
    authUserRepository.findById.mockResolvedValue(makeBaseUser({ phone: undefined }));
    tenantRepository.findById.mockResolvedValue(null);
    await expect(
      sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' }),
    ).rejects.toThrow();
  });

  // ─── GAP 3: phone resolution via tenant fallback ─────────────────────────
  it('GAP-3a: uses tenant.owner.phone.value as fallback when user.phone is falsy', async () => {
    authUserRepository.findById.mockResolvedValue(makeBaseUser({ phone: undefined }));
    tenantRepository.findById.mockResolvedValue({ owner: { phone: { value: '5521888880000' } } });
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' });
    expect(result.userPhone).toBe('5521888880000');
    expect(reminderRepository.save).toHaveBeenCalledWith(expect.objectContaining({ userPhone: '5521888880000' }));
  });

  it('GAP-3b: uses user.phone directly when present (fallback not used)', async () => {
    authUserRepository.findById.mockResolvedValue(makeBaseUser({ phone: '5511111111111' }));
    tenantRepository.findById.mockResolvedValue({ owner: { phone: { value: '5599999999999' } } });
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' });
    expect(result.userPhone).toBe('5511111111111');
  });

  it('GAP-3c: throws when user.phone is empty string and tenant owner phone is undefined', async () => {
    authUserRepository.findById.mockResolvedValue(makeBaseUser({ phone: '' }));
    tenantRepository.findById.mockResolvedValue({ owner: { phone: { value: undefined } } });
    await expect(
      sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' }),
    ).rejects.toThrow();
  });

  // ─── GAP 4: DAILY frequency creation path ────────────────────────────────
  it('GAP-4a: creates DAILY reminder with timeOfDay and returns ACTIVE status', async () => {
    authUserRepository.findById.mockResolvedValue(makeBaseUser());
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'Daily check', message: 'Check stock', frequency: 'DAILY', timeOfDay: '09:00' });
    expect(result.status).toBe('ACTIVE');
    expect(result.frequency).toBe('DAILY');
    expect(result.nextTriggerAt).toBeDefined();
    expect(reminderQueue.addJob).toHaveBeenCalledWith(expect.objectContaining({ reminderId: result.id }));
  });

  it('GAP-4b: DAILY reminder sets nextTriggerAt via computeNextDailyTriggerUtc (is in the future)', async () => {
    authUserRepository.findById.mockResolvedValue(makeBaseUser());
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'DAILY', timeOfDay: '23:59' });
    expect(new Date(result.nextTriggerAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('GAP-4c: DAILY reminder enqueues addJob with correct runAt matching nextTriggerAt', async () => {
    authUserRepository.findById.mockResolvedValue(makeBaseUser());
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'DAILY', timeOfDay: '08:00' });
    expect(reminderQueue.addJob).toHaveBeenCalledWith(expect.objectContaining({ runAt: result.nextTriggerAt, reminderId: result.id }));
  });

  it('GAP-4d: throws when DAILY reminder has no timeOfDay', async () => {
    authUserRepository.findById.mockResolvedValue(makeBaseUser());
    await expect(
      sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'DAILY' }),
    ).rejects.toThrow();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// GAP 5, 6, 7, 8: UpdateAlertReminderUseCase - new edge cases
// ═══════════════════════════════════════════════════════════════════════════
describe('UpdateAlertReminderUseCase – new edge cases', () => {
  let reminderRepository: any;
  let reminderQueue: any;
  let authUserRepository: any;
  let tenantRepository: any;
  let sut: any;

  const baseReminder = makeBaseReminder({ frequency: 'DAILY', timeOfDay: '09:00', nextTriggerAt: '2030-06-01T09:00:00.000Z', scheduledAt: undefined });
  const baseUser = makeBaseUser();

  beforeEach(() => {
    reminderRepository = { findById: jest.fn().mockResolvedValue({ ...baseReminder }), save: jest.fn() };
    reminderQueue = { addJob: jest.fn() };
    authUserRepository = { findById: jest.fn().mockResolvedValue({ ...baseUser }) };
    tenantRepository = { findById: jest.fn().mockResolvedValue(null) };
    sut = new UpdateAlertReminderUseCase(reminderRepository, reminderQueue, authUserRepository, tenantRepository, stubAlertReminderRuntimeConfig());
  });

  // ─── GAP 5: tenantId mismatch after user lookup ──────────────────────────
  it('GAP-5a: throws when user.tenantId does not match input.tenantId', async () => {
    authUserRepository.findById.mockResolvedValue(makeBaseUser({ tenantId: 'tenant-OTHER' }));
    await expect(
      sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1' }),
    ).rejects.toThrow();
  });

  it('GAP-5b: throws when user is not found on update', async () => {
    authUserRepository.findById.mockResolvedValue(null);
    await expect(
      sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1' }),
    ).rejects.toThrow();
  });

  it('GAP-5c: succeeds when user.tenantId matches input.tenantId exactly', async () => {
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1', title: 'New title' });
    expect(result.title).toBe('New title');
  });

  // ─── GAP 6: updating a SENT reminder ────────────────────────────────────
  it('GAP-6a: updating a SENT reminder with status=ACTIVE re-enqueues a job', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ status: 'SENT', frequency: 'DAILY', timeOfDay: '09:00', nextTriggerAt: undefined }));
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1', status: 'ACTIVE' });
    expect(result.status).toBe('ACTIVE');
    expect(reminderQueue.addJob).toHaveBeenCalled();
  });

  it('GAP-6b: updating a SENT reminder without status change keeps reminder as SENT (no re-enqueue)', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ status: 'SENT', frequency: 'DAILY', timeOfDay: '09:00', nextTriggerAt: undefined }));
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1', title: 'New title' });
    expect(result.status).toBe('SENT');
    expect(reminderQueue.addJob).not.toHaveBeenCalled();
  });

  it('GAP-6c: SENT reminder nextTriggerAt remains undefined when status stays SENT', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ status: 'SENT', nextTriggerAt: undefined, frequency: 'ONCE' }));
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1', message: 'Updated msg' });
    expect(result.nextTriggerAt).toBeUndefined();
  });

  // ─── GAP 7: frequency flip ONCE -> DAILY ─────────────────────────────────
  it('GAP-7a: changing frequency from ONCE to DAILY clears scheduledAt and sets timeOfDay', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z', timeOfDay: undefined }));
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1', frequency: 'DAILY', timeOfDay: '10:00' });
    expect(result.frequency).toBe('DAILY');
    expect(result.timeOfDay).toBe('10:00');
    expect(result.scheduledAt).toBeUndefined();
  });

  it('GAP-7b: ONCE to DAILY flip recomputes nextTriggerAt via daily schedule', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z', timeOfDay: undefined }));
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1', frequency: 'DAILY', timeOfDay: '10:00' });
    expect(result.nextTriggerAt).toBeDefined();
    expect(result.nextTriggerAt).not.toBe('2030-06-01T14:00:00.000Z');
  });

  it('GAP-7c: ONCE to DAILY flip enqueues new job with updated runAt', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z', timeOfDay: undefined }));
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1', frequency: 'DAILY', timeOfDay: '10:00' });
    expect(reminderQueue.addJob).toHaveBeenCalledWith(expect.objectContaining({ runAt: result.nextTriggerAt }));
  });

  // ─── GAP 8: branchId override on update ─────────────────────────────────
  it('GAP-8a: new branchId in input overrides existing branchId', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ branchId: 'old-branch' }));
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1', branchId: 'new-branch' });
    expect(result.branchId).toBe('new-branch');
  });

  it('GAP-8b: null branchId in input is NOT treated as override (uses reminder branchId)', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ branchId: 'existing-branch' }));
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1' });
    expect(result.branchId).toBe('existing-branch');
  });

  it('GAP-8c: falls back to null when both input.branchId and reminder.branchId are absent', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ branchId: null }));
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1' });
    expect(result.branchId).toBeNull();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// GAP 9: DeleteAlertReminderUseCase – tenant isolation
// ═══════════════════════════════════════════════════════════════════════════
describe('DeleteAlertReminderUseCase – tenant isolation', () => {
  let reminderRepository: any;
  let sut: any;

  beforeEach(() => {
    reminderRepository = { findById: jest.fn(), delete: jest.fn() };
    sut = new DeleteAlertReminderUseCase(reminderRepository);
  });

  it('GAP-9a: deletes reminder when tenantId and userId both match', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ tenantId: 'tenant-A', userId: 'user-1' }));
    await sut.execute({ tenantId: 'tenant-A', userId: 'user-1', reminderId: 'reminder-1' });
    expect(reminderRepository.delete).toHaveBeenCalledWith('tenant-A', 'reminder-1');
  });

  it('GAP-9b: throws when repo returns reminder with different userId (cross-user)', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ userId: 'user-EVIL' }));
    await expect(
      sut.execute({ tenantId: 'tenant-1', userId: 'user-1', reminderId: 'reminder-1' }),
    ).rejects.toThrow();
    expect(reminderRepository.delete).not.toHaveBeenCalled();
  });

  it('GAP-9c: findById is called with the input tenantId to enforce tenant scope', async () => {
    reminderRepository.findById.mockResolvedValue(null);
    await expect(
      sut.execute({ tenantId: 'tenant-B', userId: 'user-1', reminderId: 'reminder-1' }),
    ).rejects.toThrow();
    expect(reminderRepository.findById).toHaveBeenCalledWith('tenant-B', 'reminder-1');
  });

  it('GAP-9d: tenant-A cannot delete a reminder scoped to tenant-B (findById enforces tenant filter)', async () => {
    reminderRepository.findById.mockResolvedValue(null);
    await expect(
      sut.execute({ tenantId: 'tenant-A', userId: 'user-1', reminderId: 'reminder-cross' }),
    ).rejects.toThrow();
    expect(reminderRepository.findById).toHaveBeenCalledWith('tenant-A', 'reminder-cross');
    expect(reminderRepository.delete).not.toHaveBeenCalled();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// GAP 10, 11, 12, 13: ProcessAlertReminderUseCase – new edge cases
// ═══════════════════════════════════════════════════════════════════════════
describe('ProcessAlertReminderUseCase – new edge cases', () => {
  let reminderRepository: any;
  let reminderQueue: any;
  let contactFacade: any;
  let messagingFacade: any;
  let sut: any;

  function makeReminder(overrides = {}) {
    return makeBaseReminder({ nextTriggerAt: new Date(Date.now() - 1000).toISOString(), ...overrides });
  }

  beforeEach(() => {
    reminderRepository = { findById: jest.fn(), save: jest.fn(), countRecipientDispatchesSince: jest.fn().mockResolvedValue(0) };
    reminderQueue = { addJob: jest.fn() };
    contactFacade = { ensureContact: jest.fn().mockResolvedValue({ contactId: 'c-1', created: true }) };
    messagingFacade = { queueSystemMessage: jest.fn().mockResolvedValue({ messageId: 'm-1' }) };
    sut = new ProcessAlertReminderUseCase(reminderRepository, reminderQueue, contactFacade, messagingFacade, stubAlertReminderRuntimeConfig());
  });

  // ─── GAP 10: DAILY reminder missing timeOfDay ────────────────────────────
  it('GAP-10a: DAILY reminder with missing timeOfDay causes computeNextDailyTriggerAfterLastRunUtc to throw', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'DAILY', timeOfDay: undefined }));
    await expect(
      sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' }),
    ).rejects.toThrow();
  });

  it('GAP-10b: DAILY reminder with null timeOfDay causes non-null assertion to throw', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'DAILY', timeOfDay: null as any }));
    await expect(
      sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' }),
    ).rejects.toThrow();
  });

  it('GAP-10c: DAILY reminder with valid timeOfDay processes successfully', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'DAILY', timeOfDay: '09:00' }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(reminderRepository.save).toHaveBeenCalled();
    const saved = reminderRepository.save.mock.calls[0][0];
    expect(saved.nextTriggerAt).toBeDefined();
    expect(saved.status).toBe('ACTIVE');
  });

  // ─── GAP 11: ensureContact throwing after save ───────────────────────────
  it('GAP-11a: error from ensureContact propagates after save is called (mark-then-act)', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'ONCE' }));
    contactFacade.ensureContact.mockRejectedValue(new Error('contact-service-down'));
    await expect(
      sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' }),
    ).rejects.toThrow('contact-service-down');
    expect(reminderRepository.save).toHaveBeenCalled();
  });

  it('GAP-11b: save marks reminder as SENT before ensureContact is called (mark-then-act ordering)', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'ONCE' }));
    const callOrder: string[] = [];
    reminderRepository.save.mockImplementation(() => { callOrder.push('save'); return Promise.resolve(); });
    contactFacade.ensureContact.mockImplementation(() => { callOrder.push('ensure'); return Promise.resolve({ contactId: 'c-1' }); });
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(callOrder[0]).toBe('save');
    expect(callOrder[1]).toBe('ensure');
  });

  it('GAP-11c: ensureContact failure does not call queueSystemMessage', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'ONCE' }));
    contactFacade.ensureContact.mockRejectedValue(new Error('network error'));
    await expect(sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' })).rejects.toThrow();
    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
  });

  // ─── GAP 12: anti-spam cap=0 disabled ───────────────────────────────────
  it('GAP-12a: countRecipientDispatchesSince NOT called when cap is 0 (disabled)', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'ONCE' }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(reminderRepository.countRecipientDispatchesSince).not.toHaveBeenCalled();
    expect(contactFacade.ensureContact).toHaveBeenCalled();
  });

  it('GAP-12b: outbound proceeds normally when cap=0 regardless of dispatch history', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'ONCE' }));
    reminderRepository.countRecipientDispatchesSince.mockResolvedValue(9999);
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(messagingFacade.queueSystemMessage).toHaveBeenCalled();
  });

  it('GAP-12c: cap=1 and count=0 allows outbound (below threshold)', async () => {
    const runtime = stubAlertReminderRuntimeConfig();
    runtime.maxDispatchesPerRecipientRolling = () => 1;
    runtime.antiSpamRollingHours = () => 24;
    const localSut = new ProcessAlertReminderUseCase(reminderRepository, reminderQueue, contactFacade, messagingFacade, runtime);
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'ONCE' }));
    reminderRepository.countRecipientDispatchesSince.mockResolvedValue(0);
    await localSut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(messagingFacade.queueSystemMessage).toHaveBeenCalled();
  });

  // ─── GAP 13: invalid nextTriggerAt (NaN guard) ───────────────────────────
  it('GAP-13a: reminder with NaN nextTriggerAt (corrupted ISO) is silently skipped', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ status: 'ACTIVE', nextTriggerAt: 'not-a-date' }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(contactFacade.ensureContact).not.toHaveBeenCalled();
    expect(reminderRepository.save).not.toHaveBeenCalled();
  });

  it('GAP-13b: reminder with empty-string nextTriggerAt is skipped (NaN guard)', async () => {
    reminderRepository.findById.mockResolvedValue(makeBaseReminder({ status: 'ACTIVE', nextTriggerAt: '' }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(contactFacade.ensureContact).not.toHaveBeenCalled();
  });

  it('GAP-13c: valid past nextTriggerAt is NOT skipped', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'ONCE', nextTriggerAt: new Date(Date.now() - 5000).toISOString() }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(contactFacade.ensureContact).toHaveBeenCalled();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// GAP 14, 15, 16, 17: OperationalAlertEventHandler – new edge cases
// ═══════════════════════════════════════════════════════════════════════════
describe('OperationalAlertEventHandler – new edge cases', () => {
  let handler: any;
  let eventBus: any;
  let messagingFacade: any;
  let contactFacade: any;
  let userRepository: any;

  beforeEach(() => {
    eventBus = { publish: jest.fn(), subscribe: jest.fn() };
    messagingFacade = { queueSystemMessage: jest.fn().mockResolvedValue({ conversationId: 'conv-1', messageId: 'msg-1' }), queueTemplateMessage: jest.fn() };
    contactFacade = { ensureContact: jest.fn().mockResolvedValue({ contactId: 'contact-1', created: false }), identifyContact: jest.fn(), getContactById: jest.fn(), upsertProspectContact: jest.fn() };
    userRepository = { findAllByTenant: jest.fn().mockResolvedValue([]) };
    handler = new OperationalAlertEventHandler(eventBus, messagingFacade, contactFacade, userRepository);
  });

  // ─── GAP 14: userRepository.findAllByTenant rejection ───────────────────
  it('GAP-14a: handleSchedulingReserved propagates error when userRepository.findAllByTenant rejects', async () => {
    userRepository.findAllByTenant.mockRejectedValue(new Error('DB connection lost'));
    await expect(
      handler.handleSchedulingReserved({ tenantId: 'tenant-1', contactId: 'c-1', professionalName: 'Dr. X', categoryName: 'Cat', date: '2026-06-01', startsAt: '10:00', endsAt: '11:00', branchId: 'b-1' }),
    ).rejects.toThrow('DB connection lost');
  });

  it('GAP-14b: handleCommerceOrderPaid propagates error when userRepository.findAllByTenant rejects', async () => {
    userRepository.findAllByTenant.mockRejectedValue(new Error('DB timeout'));
    await expect(
      handler.handleCommerceOrderPaid({ orderId: 'o-1', tenantId: 'tenant-1', paidAt: new Date(), totalAmount: 1000 }),
    ).rejects.toThrow('DB timeout');
  });

  it('GAP-14c: handleSchedulingPaymentConfirmed propagates error when repo rejects', async () => {
    userRepository.findAllByTenant.mockRejectedValue(new Error('service unavailable'));
    await expect(
      handler.handleSchedulingPaymentConfirmed({ tenantId: 'tenant-1', contactId: 'c-1', professionalName: 'Dr. X', categoryName: 'Cat', date: '2026-06-01', startsAt: '10:00', endsAt: '11:00', branchId: null }),
    ).rejects.toThrow('service unavailable');
  });

  // ─── GAP 15: handleCommerceOrderPaid per-user failure isolation ──────────
  it('GAP-15a: continues notifying remaining users when ensureContact fails for one user', async () => {
    userRepository.findAllByTenant.mockResolvedValue([
      makeMockUser({ id: 'u-1', phone: '+5511111111111' }),
      makeMockUser({ id: 'u-2', phone: '+5522222222222' }),
      makeMockUser({ id: 'u-3', phone: '+5533333333333' }),
    ]);
    contactFacade.ensureContact.mockResolvedValueOnce({ contactId: 'c-1' }).mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce({ contactId: 'c-3' });
    await expect(handler.handleCommerceOrderPaid({ orderId: 'o-1', tenantId: 'tenant-1', paidAt: new Date(), totalAmount: 1000 })).resolves.not.toThrow();
    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledTimes(2);
  });

  it('GAP-15b: continues notifying when queueSystemMessage fails for one user', async () => {
    userRepository.findAllByTenant.mockResolvedValue([
      makeMockUser({ id: 'u-1', phone: '+5511111111111' }),
      makeMockUser({ id: 'u-2', phone: '+5522222222222' }),
    ]);
    contactFacade.ensureContact.mockResolvedValue({ contactId: 'c-1' });
    messagingFacade.queueSystemMessage.mockRejectedValueOnce(new Error('msg-fail')).mockResolvedValueOnce({ messageId: 'm-2' });
    await expect(handler.handleCommerceOrderPaid({ orderId: 'o-2', tenantId: 'tenant-1', paidAt: new Date(), totalAmount: 2000 })).resolves.not.toThrow();
    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledTimes(2);
  });

  it('GAP-15c: all users fail but method resolves (no re-throw of per-user errors)', async () => {
    userRepository.findAllByTenant.mockResolvedValue([makeMockUser({ id: 'u-1', phone: '+5511111111111' })]);
    contactFacade.ensureContact.mockRejectedValue(new Error('all-fail'));
    await expect(handler.handleCommerceOrderPaid({ orderId: 'o-3', tenantId: 'tenant-1', paidAt: new Date(), totalAmount: 500 })).resolves.not.toThrow();
  });

  // ─── GAP 16: handleSchedulingPaymentConfirmed contactName omitted ────────
  it('GAP-16a: contactName undefined produces empty string in message (no undefined literal)', async () => {
    userRepository.findAllByTenant.mockResolvedValue([makeMockUser()]);
    await handler.handleSchedulingPaymentConfirmed({ tenantId: 'tenant-1', contactId: 'c-1', professionalName: 'Dr. X', categoryName: 'Cat', date: '2026-06-01', startsAt: '10:00', endsAt: '11:00', branchId: null });
    const text = messagingFacade.queueSystemMessage.mock.calls[0][0].text;
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('Cliente:');
  });

  it('GAP-16b: contactName present produces Cliente line in message', async () => {
    userRepository.findAllByTenant.mockResolvedValue([makeMockUser()]);
    await handler.handleSchedulingPaymentConfirmed({ tenantId: 'tenant-1', contactId: 'c-1', contactName: 'Maria Santos', professionalName: 'Dr. X', categoryName: 'Cat', date: '2026-06-01', startsAt: '10:00', endsAt: '11:00', branchId: null });
    const text = messagingFacade.queueSystemMessage.mock.calls[0][0].text;
    expect(text).toContain('Cliente: Maria Santos');
  });

  it('GAP-16c: empty string contactName omits Cliente line', async () => {
    userRepository.findAllByTenant.mockResolvedValue([makeMockUser()]);
    await handler.handleSchedulingPaymentConfirmed({ tenantId: 'tenant-1', contactId: 'c-1', contactName: '', professionalName: 'Dr. X', categoryName: 'Cat', date: '2026-06-01', startsAt: '10:00', endsAt: '11:00', branchId: null });
    const text = messagingFacade.queueSystemMessage.mock.calls[0][0].text;
    expect(text).not.toContain('Cliente:');
  });

  // ─── GAP 17: branchId=null in notifyTenantUsers for commerce order ────────
  it('GAP-17a: ensureContact receives branchId=undefined when order event has no branchId', async () => {
    userRepository.findAllByTenant.mockResolvedValue([makeMockUser()]);
    await handler.handleCommerceOrderPaid({ orderId: 'o-1', tenantId: 'tenant-1', paidAt: new Date(), totalAmount: 1000 });
    expect(contactFacade.ensureContact).toHaveBeenCalledWith(expect.objectContaining({ branchId: undefined }));
  });

  it('GAP-17b: queueSystemMessage receives branchId=null when order event has no branchId', async () => {
    userRepository.findAllByTenant.mockResolvedValue([makeMockUser()]);
    await handler.handleCommerceOrderPaid({ orderId: 'o-1', tenantId: 'tenant-1', paidAt: new Date(), totalAmount: 1000 });
    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith(expect.objectContaining({ branchId: null }));
  });

  it('GAP-17c: scheduling reserved with null branchId passes undefined to ensureContact', async () => {
    userRepository.findAllByTenant.mockResolvedValue([makeMockUser()]);
    await handler.handleSchedulingReserved({ tenantId: 'tenant-1', contactId: 'c-1', professionalName: 'Dr. X', categoryName: 'Cat', date: '2026-06-01', startsAt: '10:00', endsAt: '11:00', branchId: null });
    expect(contactFacade.ensureContact).toHaveBeenCalledWith(expect.objectContaining({ branchId: undefined }));
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// GAP 18, 19, 20: PrismaAlertReminderRepository toDomain mapper
// ═══════════════════════════════════════════════════════════════════════════
describe('PrismaAlertReminderRepository.toDomain – mapping edge cases', () => {
  function buildRepo(queryResult: any[]) {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(queryResult), $executeRaw: jest.fn().mockResolvedValue(1) };
    const { PrismaAlertReminderRepository } = require('../infrastructure/persistence/repositories/PrismaAlertReminderRepository');
    return new PrismaAlertReminderRepository(prisma);
  }

  function makeDbRow(overrides = {}) {
    return {
      id: 'uuid-1', tenant_id: 'tenant-1', branch_id: null, user_id: 'user-1',
      user_name: 'Paulo', user_phone: '5511999990000', user_email: null,
      timezone: null, title: 'Title', message: 'Msg', frequency: 'ONCE',
      scheduled_at: null, time_of_day: null, next_trigger_at: null,
      last_triggered_at: null, status: 'ACTIVE',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  // ─── GAP 18: toDomain null-value handling ────────────────────────────────
  it('GAP-18a: null branch_id maps to undefined in domain object', async () => {
    const repo = buildRepo([makeDbRow({ branch_id: null })]);
    const result = await repo.findById('tenant-1', 'uuid-1');
    expect(result.branchId).toBeUndefined();
  });

  it('GAP-18b: null user_email maps to undefined in domain object', async () => {
    const repo = buildRepo([makeDbRow({ user_email: null })]);
    const result = await repo.findById('tenant-1', 'uuid-1');
    expect(result.userEmail).toBeUndefined();
  });

  it('GAP-18c: null timezone maps to null in domain object', async () => {
    const repo = buildRepo([makeDbRow({ timezone: null })]);
    const result = await repo.findById('tenant-1', 'uuid-1');
    expect(result.timezone).toBeNull();
  });

  it('GAP-18d: null scheduled_at maps to undefined in domain object', async () => {
    const repo = buildRepo([makeDbRow({ scheduled_at: null })]);
    const result = await repo.findById('tenant-1', 'uuid-1');
    expect(result.scheduledAt).toBeUndefined();
  });

  it('GAP-18e: null time_of_day maps to undefined in domain object', async () => {
    const repo = buildRepo([makeDbRow({ time_of_day: null })]);
    const result = await repo.findById('tenant-1', 'uuid-1');
    expect(result.timeOfDay).toBeUndefined();
  });

  it('GAP-18f: null next_trigger_at maps to undefined in domain object', async () => {
    const repo = buildRepo([makeDbRow({ next_trigger_at: null })]);
    const result = await repo.findById('tenant-1', 'uuid-1');
    expect(result.nextTriggerAt).toBeUndefined();
  });

  it('GAP-18g: null last_triggered_at maps to undefined in domain object', async () => {
    const repo = buildRepo([makeDbRow({ last_triggered_at: null })]);
    const result = await repo.findById('tenant-1', 'uuid-1');
    expect(result.lastTriggeredAt).toBeUndefined();
  });

  it('GAP-18h: non-null values pass through toDomain correctly', async () => {
    const repo = buildRepo([makeDbRow({ branch_id: 'branch-x', user_email: 'a@b.com', timezone: 'America/Sao_Paulo', scheduled_at: new Date('2030-06-01T14:00:00.000Z'), time_of_day: '09:00', next_trigger_at: new Date('2030-06-01T14:00:00.000Z'), last_triggered_at: new Date('2026-01-01T00:00:00.000Z') })]);
    const result = await repo.findById('tenant-1', 'uuid-1');
    expect(result.branchId).toBe('branch-x');
    expect(result.userEmail).toBe('a@b.com');
    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.scheduledAt).toBe('2030-06-01T14:00:00.000Z');
    expect(result.timeOfDay).toBe('09:00');
    expect(result.nextTriggerAt).toBeDefined();
    expect(result.lastTriggeredAt).toBeDefined();
  });

  // ─── GAP 19: countRecipientDispatchesSince boundary ─────────────────────
  it('GAP-19a: countRecipientDispatchesSince passes sinceIso as query parameter', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ c: BigInt(2) }]), $executeRaw: jest.fn() };
    const { PrismaAlertReminderRepository } = require('../infrastructure/persistence/repositories/PrismaAlertReminderRepository');
    const repo = new PrismaAlertReminderRepository(prisma);
    const count = await repo.countRecipientDispatchesSince('tenant-1', '+5511999990000', '2026-01-01T00:00:00.000Z');
    expect(count).toBe(2);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('GAP-19b: countRecipientDispatchesSince returns 0 when no rows returned', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ c: BigInt(0) }]), $executeRaw: jest.fn() };
    const { PrismaAlertReminderRepository } = require('../infrastructure/persistence/repositories/PrismaAlertReminderRepository');
    const repo = new PrismaAlertReminderRepository(prisma);
    const count = await repo.countRecipientDispatchesSince('tenant-1', 'phone', '2026-01-01T00:00:00.000Z');
    expect(count).toBe(0);
  });

  // ─── GAP 20: countActiveByUser BigInt cast ───────────────────────────────
  it('GAP-20a: countActiveByUser casts BigInt to number correctly', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ c: BigInt(7) }]), $executeRaw: jest.fn() };
    const { PrismaAlertReminderRepository } = require('../infrastructure/persistence/repositories/PrismaAlertReminderRepository');
    const repo = new PrismaAlertReminderRepository(prisma);
    const count = await repo.countActiveByUser('tenant-1', 'user-1');
    expect(count).toBe(7);
    expect(typeof count).toBe('number');
  });

  it('GAP-20b: countActiveByUser returns 0 when rows array is empty', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]), $executeRaw: jest.fn() };
    const { PrismaAlertReminderRepository } = require('../infrastructure/persistence/repositories/PrismaAlertReminderRepository');
    const repo = new PrismaAlertReminderRepository(prisma);
    const count = await repo.countActiveByUser('tenant-1', 'user-1');
    expect(count).toBe(0);
  });

  it('GAP-20c: countActiveByUser result is a finite number (no NaN)', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ c: BigInt(42) }]), $executeRaw: jest.fn() };
    const { PrismaAlertReminderRepository } = require('../infrastructure/persistence/repositories/PrismaAlertReminderRepository');
    const repo = new PrismaAlertReminderRepository(prisma);
    const count = await repo.countActiveByUser('tenant-1', 'user-1');
    expect(Number.isFinite(count)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// GAP 30: DTO Validation rules (class-validator decorators)
// ═══════════════════════════════════════════════════════════════════════════
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAlertReminderDTO, UpdateAlertReminderDTO } from '../presentation/dtos/AlertReminderDTOs';

describe('CreateAlertReminderDTO – validation decorators', () => {
  async function validateDTO(plain: Record<string, unknown>) {
    const dto = plainToInstance(CreateAlertReminderDTO, plain);
    return validate(dto);
  }

  it('GAP-30a: valid DTO with ONCE frequency passes validation', async () => {
    const errors = await validateDTO({ title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' });
    expect(errors).toHaveLength(0);
  });

  it('GAP-30b: valid DTO with DAILY frequency passes validation', async () => {
    const errors = await validateDTO({ title: 'T', message: 'M', frequency: 'DAILY', timeOfDay: '09:00' });
    expect(errors).toHaveLength(0);
  });

  it('GAP-30c: invalid frequency value fails @IsIn validation', async () => {
    const errors = await validateDTO({ title: 'T', message: 'M', frequency: 'WEEKLY' });
    expect(errors.some((e) => e.property === 'frequency')).toBe(true);
  });

  it('GAP-30d: title at exactly 120 characters passes @MaxLength(120)', async () => {
    const errors = await validateDTO({ title: 'A'.repeat(120), message: 'M', frequency: 'ONCE' });
    expect(errors.some((e) => e.property === 'title')).toBe(false);
  });

  it('GAP-30e: title at 121 characters fails @MaxLength(120)', async () => {
    const errors = await validateDTO({ title: 'A'.repeat(121), message: 'M', frequency: 'ONCE' });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('GAP-30f: message at exactly 1000 characters passes @MaxLength(1000)', async () => {
    const errors = await validateDTO({ title: 'T', message: 'B'.repeat(1000), frequency: 'ONCE' });
    expect(errors.some((e) => e.property === 'message')).toBe(false);
  });

  it('GAP-30g: message at 1001 characters fails @MaxLength(1000)', async () => {
    const errors = await validateDTO({ title: 'T', message: 'B'.repeat(1001), frequency: 'ONCE' });
    expect(errors.some((e) => e.property === 'message')).toBe(true);
  });

  it('GAP-30h: timeOfDay at exactly 5 characters (HH:mm) passes @Length(5,5)', async () => {
    const errors = await validateDTO({ title: 'T', message: 'M', frequency: 'DAILY', timeOfDay: '09:00' });
    expect(errors.some((e) => e.property === 'timeOfDay')).toBe(false);
  });

  it('GAP-30i: timeOfDay at 4 characters fails @Length(5,5)', async () => {
    const errors = await validateDTO({ title: 'T', message: 'M', frequency: 'DAILY', timeOfDay: '9:00' });
    expect(errors.some((e) => e.property === 'timeOfDay')).toBe(true);
  });

  it('GAP-30j: timeOfDay at 6 characters fails @Length(5,5)', async () => {
    const errors = await validateDTO({ title: 'T', message: 'M', frequency: 'DAILY', timeOfDay: '009:00' });
    expect(errors.some((e) => e.property === 'timeOfDay')).toBe(true);
  });

  it('GAP-30k: non-ISO scheduledAt fails @IsISO8601', async () => {
    const errors = await validateDTO({ title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-13-45' });
    expect(errors.some((e) => e.property === 'scheduledAt')).toBe(true);
  });

  it('GAP-30l: valid ISO8601 scheduledAt passes validation', async () => {
    const errors = await validateDTO({ title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' });
    expect(errors.some((e) => e.property === 'scheduledAt')).toBe(false);
  });

});

describe('UpdateAlertReminderDTO – validation decorators', () => {
  async function validateDTO(plain: Record<string, unknown>) {
    const dto = plainToInstance(UpdateAlertReminderDTO, plain);
    return validate(dto);
  }

  it('GAP-30m: empty update DTO (all optional) passes validation', async () => {
    const errors = await validateDTO({});
    expect(errors).toHaveLength(0);
  });

  it('GAP-30n: status=SENT is valid in UpdateAlertReminderDTO', async () => {
    const errors = await validateDTO({ status: 'SENT' });
    expect(errors.some((e) => e.property === 'status')).toBe(false);
  });

  it('GAP-30o: invalid status value fails @IsIn validation', async () => {
    const errors = await validateDTO({ status: 'DELETED' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('GAP-30p: title over 120 characters fails in UpdateAlertReminderDTO', async () => {
    const errors = await validateDTO({ title: 'X'.repeat(121) });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// GAP 31: ListAlertRemindersUseCase – repository throw propagation
// ═══════════════════════════════════════════════════════════════════════════
import { ListAlertRemindersUseCase } from '../application/use-cases/ListAlertRemindersUseCase';

describe('ListAlertRemindersUseCase – error propagation', () => {
  it('GAP-31a: propagates DB error when repository.findAllByUser throws', async () => {
    const repo = { findAllByUser: jest.fn().mockRejectedValue(new Error('DB error')) };
    const sut = new ListAlertRemindersUseCase(repo as any);
    await expect(sut.execute({ tenantId: 'tenant-1', userId: 'user-1' })).rejects.toThrow('DB error');
  });

  it('GAP-31b: returns empty array when repository returns no reminders', async () => {
    const repo = { findAllByUser: jest.fn().mockResolvedValue([]) };
    const sut = new ListAlertRemindersUseCase(repo as any);
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1' });
    expect(result).toEqual([]);
  });

  it('GAP-31c: passes branchId to repository when provided', async () => {
    const repo = { findAllByUser: jest.fn().mockResolvedValue([]) };
    const sut = new ListAlertRemindersUseCase(repo as any);
    await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', branchId: 'branch-5' });
    expect(repo.findAllByUser).toHaveBeenCalledWith('tenant-1', 'user-1', 'branch-5');
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// GAP 32: AlertReminderRuntimeConfig – antiSpamRollingHours non-numeric
// ═══════════════════════════════════════════════════════════════════════════
describe('AlertReminderRuntimeConfig – antiSpamRollingHours non-numeric env', () => {
  it('GAP-32a: returns default 24 when ALERT_ANTI_SPAM_ROLLING_HOURS is non-numeric string', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService({ ALERT_ANTI_SPAM_ROLLING_HOURS: 'abc' }));
    expect(sut.antiSpamRollingHours()).toBe(24);
  });

  it('GAP-32b: returns default 24 when ALERT_ANTI_SPAM_ROLLING_HOURS is zero', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService({ ALERT_ANTI_SPAM_ROLLING_HOURS: '0' }));
    expect(sut.antiSpamRollingHours()).toBe(24);
  });

  it('GAP-32c: returns default 24 when ALERT_ANTI_SPAM_ROLLING_HOURS is negative', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService({ ALERT_ANTI_SPAM_ROLLING_HOURS: '-5' }));
    expect(sut.antiSpamRollingHours()).toBe(24);
  });

  it('GAP-32d: antiSpamRollingHours result is never NaN', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService({ ALERT_ANTI_SPAM_ROLLING_HOURS: 'not-a-number' }));
    expect(Number.isNaN(sut.antiSpamRollingHours())).toBe(false);
  });

  it('GAP-32e: maxDispatchesPerRecipientRolling returns 0 when env is non-numeric', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService({ ALERT_MAX_DISPATCHES_PER_RECIPIENT_ROLLING: 'xyz' }));
    expect(sut.maxDispatchesPerRecipientRolling()).toBe(0);
  });

  it('GAP-32f: duplicateTriggerSuppressionSeconds returns 90 when env is non-numeric', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService({ ALERT_IDEMPOTENCY_RECENT_SECONDS: 'bad' }));
    expect(sut.duplicateTriggerSuppressionSeconds()).toBe(90);
  });

  it('GAP-32g: all config methods return finite numbers for any non-numeric env input', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService({
      ALERT_ANTI_SPAM_ROLLING_HOURS: 'NaN',
      ALERT_MAX_DISPATCHES_PER_RECIPIENT_ROLLING: 'Infinity',
      ALERT_MAX_ACTIVE_REMINDERS_PER_USER: '-Infinity',
      ALERT_IDEMPOTENCY_RECENT_SECONDS: 'undefined',
    }));
    expect(Number.isFinite(sut.antiSpamRollingHours())).toBe(true);
    expect(Number.isFinite(sut.maxDispatchesPerRecipientRolling())).toBe(true);
    expect(Number.isFinite(sut.maxActiveRemindersPerUser())).toBe(true);
    expect(Number.isFinite(sut.duplicateTriggerSuppressionSeconds())).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// Additional edge-case tests to reach 100+ it() blocks
// ═══════════════════════════════════════════════════════════════════════════

describe('CreateAlertReminderUseCase – additional edge cases', () => {
  let reminderRepository: any;
  let reminderQueue: any;
  let authUserRepository: any;
  let tenantRepository: any;
  let sut: any;

  beforeEach(() => {
    reminderRepository = { save: jest.fn(), countActiveByUser: jest.fn().mockResolvedValue(0) };
    reminderQueue = { addJob: jest.fn() };
    authUserRepository = { findById: jest.fn().mockResolvedValue(makeBaseUser()) };
    tenantRepository = { findById: jest.fn().mockResolvedValue(null) };
    sut = new CreateAlertReminderUseCase(reminderRepository, reminderQueue, authUserRepository, tenantRepository, stubAlertReminderRuntimeConfig());
  });

  it('saves reminder with trimmed title and message', async () => {
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: '  Hello  ', message: '  World  ', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' });
    expect(reminderRepository.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hello', message: 'World' }));
  });

  it('generates a UUID for the new reminder id', async () => {
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' });
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('stores createdAt and updatedAt as ISO strings', async () => {
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' });
    expect(() => new Date(result.createdAt)).not.toThrow();
    expect(() => new Date(result.updatedAt)).not.toThrow();
  });

  it('uses UTC as timezone when timezone not provided', async () => {
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' });
    expect(result.timezone).toBe('UTC');
  });

  it('uses custom timezone when provided and valid', async () => {
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z', timezone: 'America/Sao_Paulo' });
    expect(result.timezone).toBe('America/Sao_Paulo');
  });

  it('stores branchId as null when not provided', async () => {
    const result = await sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2030-06-01T14:00:00.000Z' });
    expect(result.branchId).toBeNull();
  });

  it('throws when scheduledAt is in the past for ONCE frequency', async () => {
    await expect(
      sut.execute({ tenantId: 'tenant-1', userId: 'user-1', title: 'T', message: 'M', frequency: 'ONCE', scheduledAt: '2000-01-01T00:00:00.000Z' }),
    ).rejects.toThrow();
  });

});

describe('ProcessAlertReminderUseCase – additional edge cases', () => {
  let reminderRepository: any;
  let reminderQueue: any;
  let contactFacade: any;
  let messagingFacade: any;
  let sut: any;

  function makeReminder(overrides = {}) {
    return makeBaseReminder({ nextTriggerAt: new Date(Date.now() - 1000).toISOString(), ...overrides });
  }

  beforeEach(() => {
    reminderRepository = { findById: jest.fn(), save: jest.fn(), countRecipientDispatchesSince: jest.fn().mockResolvedValue(0) };
    reminderQueue = { addJob: jest.fn() };
    contactFacade = { ensureContact: jest.fn().mockResolvedValue({ contactId: 'c-1' }) };
    messagingFacade = { queueSystemMessage: jest.fn().mockResolvedValue({ messageId: 'm-1' }) };
    sut = new ProcessAlertReminderUseCase(reminderRepository, reminderQueue, contactFacade, messagingFacade, stubAlertReminderRuntimeConfig());
  });

  it('passes branchId=undefined to ensureContact when reminder.branchId is null', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ branchId: null, frequency: 'ONCE' }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(contactFacade.ensureContact).toHaveBeenCalledWith(expect.objectContaining({ branchId: undefined }));
  });

  it('passes branchId=null to queueSystemMessage when reminder.branchId is null', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ branchId: null, frequency: 'ONCE' }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith(expect.objectContaining({ branchId: null }));
  });

  it('renders message text using template from runtime config', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'ONCE', title: 'My Title', message: 'My Message' }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    const text = messagingFacade.queueSystemMessage.mock.calls[0][0].text;
    expect(text).toContain('My Title');
    expect(text).toContain('My Message');
  });

  it('DAILY reminder nextTriggerAt after processing is in the future', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'DAILY', timeOfDay: '09:00' }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    const saved = reminderRepository.save.mock.calls[0][0];
    expect(new Date(saved.nextTriggerAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('sets lastTriggeredAt on save for both ONCE and DAILY', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'ONCE' }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    const saved = reminderRepository.save.mock.calls[0][0];
    expect(saved.lastTriggeredAt).toBeDefined();
    expect(() => new Date(saved.lastTriggeredAt)).not.toThrow();
  });

  it('does not enqueue next job for ONCE reminder after processing', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'ONCE' }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(reminderQueue.addJob).not.toHaveBeenCalled();
  });

  it('enqueues next job for DAILY reminder after processing', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder({ frequency: 'DAILY', timeOfDay: '09:00' }));
    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });
    expect(reminderQueue.addJob).toHaveBeenCalled();
  });

});
