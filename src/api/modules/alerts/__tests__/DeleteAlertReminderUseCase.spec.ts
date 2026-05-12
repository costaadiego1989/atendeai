import { DeleteAlertReminderUseCase } from '../application/use-cases/DeleteAlertReminderUseCase';

describe('DeleteAlertReminderUseCase', () => {
  let reminderRepository: any;
  let sut: DeleteAlertReminderUseCase;

  beforeEach(() => {
    reminderRepository = {
      findById: jest.fn(),
      delete: jest.fn(),
    };

    sut = new DeleteAlertReminderUseCase(reminderRepository);
  });

  it('deletes an existing reminder owned by the user', async () => {
    reminderRepository.findById.mockResolvedValue({
      id: 'reminder-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      status: 'ACTIVE',
    });

    await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      reminderId: 'reminder-1',
    });

    expect(reminderRepository.delete).toHaveBeenCalledWith('tenant-1', 'reminder-1');
  });

  it('throws when reminder belongs to a different user (ownership check)', async () => {
    reminderRepository.findById.mockResolvedValue({
      id: 'reminder-1',
      tenantId: 'tenant-1',
      userId: 'other-user',
      status: 'ACTIVE',
    });

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        userId: 'user-1',
        reminderId: 'reminder-1',
      }),
    ).rejects.toThrow();
  });

  it('throws when reminder is not found', async () => {
    reminderRepository.findById.mockResolvedValue(null);

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        userId: 'user-1',
        reminderId: 'non-existent',
      }),
    ).rejects.toThrow();
  });

  it('calls repository delete with correct tenantId and reminderId', async () => {
    reminderRepository.findById.mockResolvedValue({
      id: 'reminder-99',
      tenantId: 'tenant-5',
      userId: 'user-3',
      status: 'ACTIVE',
    });

    await sut.execute({
      tenantId: 'tenant-5',
      userId: 'user-3',
      reminderId: 'reminder-99',
    });

    expect(reminderRepository.delete).toHaveBeenCalledWith('tenant-5', 'reminder-99');
    expect(reminderRepository.delete).toHaveBeenCalledTimes(1);
  });
});
