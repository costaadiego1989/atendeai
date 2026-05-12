import { UpdateAlertReminderUseCase } from '../application/use-cases/UpdateAlertReminderUseCase';
import { stubAlertReminderRuntimeConfig } from './alert-reminder-runtime.stub';
import { AlertReminder } from '../domain/types/AlertReminder';

describe('UpdateAlertReminderUseCase', () => {
  let reminderRepository: any;
  let reminderQueue: any;
  let authUserRepository: any;
  let tenantRepository: any;
  let sut: UpdateAlertReminderUseCase;

  const baseReminder: AlertReminder = {
    id: 'reminder-1',
    tenantId: 'tenant-1',
    branchId: null,
    userId: 'user-1',
    userName: 'Paulo',
    userPhone: '5511999990000',
    userEmail: 'paulo@example.com',
    timezone: 'UTC',
    title: 'Original title',
    message: 'Original message',
    frequency: 'DAILY',
    timeOfDay: '09:00',
    nextTriggerAt: '2026-05-04T09:00:00.000Z',
    status: 'ACTIVE',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  };

  const baseUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    name: 'Paulo',
    phone: '5511999990000',
    email: { value: 'paulo@example.com' },
  };

  beforeEach(() => {
    reminderRepository = {
      findById: jest.fn().mockResolvedValue({ ...baseReminder }),
      save: jest.fn(),
    };
    reminderQueue = {
      addJob: jest.fn(),
    };
    authUserRepository = {
      findById: jest.fn().mockResolvedValue({ ...baseUser }),
    };
    tenantRepository = {
      findById: jest.fn().mockResolvedValue(null),
    };

    sut = new UpdateAlertReminderUseCase(
      reminderRepository,
      reminderQueue,
      authUserRepository,
      tenantRepository,
      stubAlertReminderRuntimeConfig(),
    );
  });

  it('updates frequency from DAILY to ONCE and reschedules', async () => {
    const result = await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      reminderId: 'reminder-1',
      frequency: 'ONCE',
      scheduledAt: '2030-06-01T14:00:00.000Z',
    });

    expect(result.frequency).toBe('ONCE');
    expect(result.nextTriggerAt).toBe('2030-06-01T14:00:00.000Z');
    expect(reminderQueue.addJob).toHaveBeenCalledWith(
      expect.objectContaining({ reminderId: 'reminder-1' }),
    );
  });

  it('throws EntityNotFoundException when reminder does not exist', async () => {
    reminderRepository.findById.mockResolvedValue(null);

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        userId: 'user-1',
        reminderId: 'non-existent',
      }),
    ).rejects.toThrow();
  });

  it('throws when userId does not match reminder owner (ownership check)', async () => {
    reminderRepository.findById.mockResolvedValue({
      ...baseReminder,
      userId: 'other-user',
    });

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        userId: 'user-1',
        reminderId: 'reminder-1',
      }),
    ).rejects.toThrow();
  });

  it('resolves timezone from input when provided', async () => {
    const result = await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      reminderId: 'reminder-1',
      timezone: 'America/Sao_Paulo',
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
  });

  it('falls back to runtime default when timezone input is empty string', async () => {
    const result = await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      reminderId: 'reminder-1',
      timezone: '',
    });

    expect(result.timezone).toBe('UTC');
  });

  it('preserves existing timezone when input.timezone is undefined', async () => {
    reminderRepository.findById.mockResolvedValue({
      ...baseReminder,
      timezone: 'America/Sao_Paulo',
    });

    const result = await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      reminderId: 'reminder-1',
      title: 'New title',
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
  });

  it('partial update only changes message, keeps other fields', async () => {
    const result = await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      reminderId: 'reminder-1',
      message: 'Updated message',
    });

    expect(result.message).toBe('Updated message');
    expect(result.title).toBe('Original title');
    expect(result.frequency).toBe('DAILY');
  });

  it('updates isActive flag (status to PAUSED) and does not enqueue', async () => {
    const result = await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      reminderId: 'reminder-1',
      status: 'PAUSED',
    });

    expect(result.status).toBe('PAUSED');
    expect(reminderQueue.addJob).not.toHaveBeenCalled();
  });

  it('reactivating a PAUSED reminder enqueues a new job', async () => {
    reminderRepository.findById.mockResolvedValue({
      ...baseReminder,
      status: 'PAUSED',
    });

    const result = await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      reminderId: 'reminder-1',
      status: 'ACTIVE',
    });

    expect(result.status).toBe('ACTIVE');
    expect(reminderQueue.addJob).toHaveBeenCalled();
  });

  it('throws when user phone is not available', async () => {
    authUserRepository.findById.mockResolvedValue({
      ...baseUser,
      phone: undefined,
    });
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        userId: 'user-1',
        reminderId: 'reminder-1',
      }),
    ).rejects.toThrow();
  });
});
