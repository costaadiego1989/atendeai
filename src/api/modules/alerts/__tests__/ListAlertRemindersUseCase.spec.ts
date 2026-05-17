import { ListAlertRemindersUseCase } from '../application/use-cases/ListAlertRemindersUseCase';

describe('ListAlertRemindersUseCase', () => {
  let reminderRepository: any;
  let sut: ListAlertRemindersUseCase;

  beforeEach(() => {
    reminderRepository = {
      findAllByUser: jest.fn(),
    };

    sut = new ListAlertRemindersUseCase(reminderRepository);
  });

  it('returns all reminders for a tenant/user', async () => {
    const reminders = [
      { id: 'r1', tenantId: 'tenant-1', userId: 'user-1', title: 'First' },
      { id: 'r2', tenantId: 'tenant-1', userId: 'user-1', title: 'Second' },
    ];
    reminderRepository.findAllByUser.mockResolvedValue(reminders);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(result).toHaveLength(2);
    expect(reminderRepository.findAllByUser).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      undefined,
    );
  });

  it('filters by branchId when provided', async () => {
    reminderRepository.findAllByUser.mockResolvedValue([
      {
        id: 'r1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        branchId: 'branch-1',
      },
    ]);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      branchId: 'branch-1',
    });

    expect(result).toHaveLength(1);
    expect(reminderRepository.findAllByUser).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'branch-1',
    );
  });

  it('returns empty array when user has no reminders', async () => {
    reminderRepository.findAllByUser.mockResolvedValue([]);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(result).toEqual([]);
  });
});
