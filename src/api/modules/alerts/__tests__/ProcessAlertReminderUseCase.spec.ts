import { ProcessAlertReminderUseCase } from '../application/use-cases/ProcessAlertReminderUseCase';
import { stubAlertReminderRuntimeConfig } from './alert-reminder-runtime.stub';
import { AlertReminder } from '../domain/types/AlertReminder';

describe('ProcessAlertReminderUseCase', () => {
  let reminderRepository: any;
  let reminderQueue: any;
  let contactFacade: any;
  let messagingFacade: any;
  let sut: ProcessAlertReminderUseCase;

  const makeReminder = (
    overrides: Partial<AlertReminder> = {},
  ): AlertReminder => ({
    id: 'reminder-1',
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    timezone: 'UTC',
    userId: 'user-1',
    userName: 'Paulo',
    userPhone: '5511999990000',
    userEmail: 'paulo@example.com',
    title: 'Verificar estoque',
    message: 'Checar ruptura de cafe',
    frequency: 'ONCE',
    nextTriggerAt: new Date(Date.now() - 1000).toISOString(),
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    reminderRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      countRecipientDispatchesSince: jest.fn().mockResolvedValue(0),
    };
    reminderQueue = {
      addJob: jest.fn(),
    };
    contactFacade = {
      ensureContact: jest
        .fn()
        .mockResolvedValue({ contactId: 'contact-1', created: true }),
    };
    messagingFacade = {
      queueSystemMessage: jest.fn().mockResolvedValue({ messageId: 'msg-1' }),
    };

    sut = new ProcessAlertReminderUseCase(
      reminderRepository,
      reminderQueue,
      contactFacade,
      messagingFacade,
      stubAlertReminderRuntimeConfig(),
    );
  });

  // ─── Existing tests ───────────────────────────────────────────────────────────

  it('should propagate branchId when processing a branch-scoped reminder', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder());

    await sut.execute({
      tenantId: 'tenant-1',
      reminderId: 'reminder-1',
      jobId: 'job-xyz',
    });

    expect(contactFacade.ensureContact).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
      }),
    );
    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        branchId: 'branch-1',
      }),
    );
  });

  it('should skip outbound when anti-spam cap is reached', async () => {
    const runtime = stubAlertReminderRuntimeConfig();
    runtime.maxDispatchesPerRecipientRolling = () => 1;
    runtime.antiSpamRollingHours = () => 24;

    const localSut = new ProcessAlertReminderUseCase(
      reminderRepository,
      reminderQueue,
      contactFacade,
      messagingFacade,
      runtime,
    );

    reminderRepository.countRecipientDispatchesSince.mockResolvedValue(3);
    reminderRepository.findById.mockResolvedValue(
      makeReminder({ branchId: null }),
    );

    await localSut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });

    expect(contactFacade.ensureContact).not.toHaveBeenCalled();
    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
    expect(reminderRepository.save).toHaveBeenCalled();
  });

  // ─── NEW: Idempotency / duplicate suppression ─────────────────────────────────

  it('suppresses duplicate trigger when lastTriggeredAt is within suppression window', async () => {
    const recentTrigger = new Date(Date.now() - 10_000).toISOString(); // 10s ago
    reminderRepository.findById.mockResolvedValue(
      makeReminder({ lastTriggeredAt: recentTrigger }),
    );

    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });

    expect(contactFacade.ensureContact).not.toHaveBeenCalled();
    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
    expect(reminderRepository.save).not.toHaveBeenCalled();
  });

  it('does NOT suppress when lastTriggeredAt is outside suppression window', async () => {
    const oldTrigger = new Date(Date.now() - 200_000).toISOString(); // 200s ago > 90s default
    reminderRepository.findById.mockResolvedValue(
      makeReminder({ lastTriggeredAt: oldTrigger }),
    );

    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });

    expect(contactFacade.ensureContact).toHaveBeenCalled();
    expect(reminderRepository.save).toHaveBeenCalled();
  });

  // ─── NEW: DAILY reschedule after processing ───────────────────────────────────

  it('reschedules DAILY reminder to next day after processing', async () => {
    reminderRepository.findById.mockResolvedValue(
      makeReminder({ frequency: 'DAILY', timeOfDay: '09:00' }),
    );

    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });

    const savedReminder = reminderRepository.save.mock.calls[0][0];
    expect(savedReminder.status).toBe('ACTIVE');
    expect(savedReminder.nextTriggerAt).toBeDefined();
    expect(savedReminder.lastTriggeredAt).toBeDefined();
    expect(reminderQueue.addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        reminderId: 'reminder-1',
        runAt: savedReminder.nextTriggerAt,
      }),
    );
  });

  it('marks ONCE reminder as SENT after processing', async () => {
    reminderRepository.findById.mockResolvedValue(
      makeReminder({ frequency: 'ONCE' }),
    );

    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });

    const savedReminder = reminderRepository.save.mock.calls[0][0];
    expect(savedReminder.status).toBe('SENT');
    expect(savedReminder.nextTriggerAt).toBeUndefined();
    expect(reminderQueue.addJob).not.toHaveBeenCalled();
  });

  // ─── NEW: Status not ACTIVE → skip ───────────────────────────────────────────

  it('skips processing when reminder status is PAUSED', async () => {
    reminderRepository.findById.mockResolvedValue(
      makeReminder({ status: 'PAUSED' }),
    );

    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });

    expect(contactFacade.ensureContact).not.toHaveBeenCalled();
    expect(reminderRepository.save).not.toHaveBeenCalled();
  });

  it('skips processing when reminder status is SENT', async () => {
    reminderRepository.findById.mockResolvedValue(
      makeReminder({ status: 'SENT' }),
    );

    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });

    expect(contactFacade.ensureContact).not.toHaveBeenCalled();
    expect(reminderRepository.save).not.toHaveBeenCalled();
  });

  // ─── NEW: nextTriggerAt in future → skip ──────────────────────────────────────

  it('skips processing when nextTriggerAt is more than 30s in the future', async () => {
    const futureDate = new Date(Date.now() + 120_000).toISOString(); // 2 min ahead
    reminderRepository.findById.mockResolvedValue(
      makeReminder({ nextTriggerAt: futureDate }),
    );

    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });

    expect(contactFacade.ensureContact).not.toHaveBeenCalled();
    expect(reminderRepository.save).not.toHaveBeenCalled();
  });

  // ─── NEW: Timezone fallback ───────────────────────────────────────────────────

  it('falls back to runtime default timezone when reminder has invalid timezone', async () => {
    reminderRepository.findById.mockResolvedValue(
      makeReminder({
        frequency: 'DAILY',
        timeOfDay: '09:00',
        timezone: 'Invalid/Zone',
      }),
    );

    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });

    const savedReminder = reminderRepository.save.mock.calls[0][0];
    expect(savedReminder.timezone).toBe('UTC'); // runtime default
  });

  it('falls back to runtime default timezone when reminder timezone is null', async () => {
    reminderRepository.findById.mockResolvedValue(
      makeReminder({ frequency: 'DAILY', timeOfDay: '09:00', timezone: null }),
    );

    await sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' });

    const savedReminder = reminderRepository.save.mock.calls[0][0];
    expect(savedReminder.timezone).toBe('UTC');
  });

  // ─── NEW: Reminder not found → early return ───────────────────────────────────

  it('returns early when reminder is not found', async () => {
    reminderRepository.findById.mockResolvedValue(null);

    await sut.execute({ tenantId: 'tenant-1', reminderId: 'non-existent' });

    expect(contactFacade.ensureContact).not.toHaveBeenCalled();
    expect(reminderRepository.save).not.toHaveBeenCalled();
  });

  // ─── NEW: Error handling (messaging failure) ──────────────────────────────────

  it('propagates error when messagingFacade.queueSystemMessage throws', async () => {
    reminderRepository.findById.mockResolvedValue(makeReminder());
    messagingFacade.queueSystemMessage.mockRejectedValue(
      new Error('Messaging service unavailable'),
    );

    await expect(
      sut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-1' }),
    ).rejects.toThrow('Messaging service unavailable');

    expect(reminderRepository.save).not.toHaveBeenCalled();
  });
});
