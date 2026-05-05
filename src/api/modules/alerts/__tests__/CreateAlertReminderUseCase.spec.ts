import { CreateAlertReminderUseCase } from '../application/use-cases/CreateAlertReminderUseCase';
import { stubAlertReminderRuntimeConfig } from './alert-reminder-runtime.stub';

describe('CreateAlertReminderUseCase', () => {
  let reminderRepository: any;
  let reminderQueue: any;
  let authUserRepository: any;
  let tenantRepository: any;
  let sut: CreateAlertReminderUseCase;

  beforeEach(() => {
    reminderRepository = {
      save: jest.fn(),
      countActiveByUser: jest.fn().mockResolvedValue(0),
    };
    reminderQueue = {
      addJob: jest.fn(),
    };
    authUserRepository = {
      findById: jest.fn(),
    };
    tenantRepository = {
      findById: jest.fn(),
    };

    sut = new CreateAlertReminderUseCase(
      reminderRepository,
      reminderQueue,
      authUserRepository,
      tenantRepository,
      stubAlertReminderRuntimeConfig(),
    );
  });

  it('should create a reminder with branch scope when active branch is informed', async () => {
    authUserRepository.findById.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      name: 'Paulo',
      phone: '5511999990000',
      email: { value: 'paulo@example.com' },
    });
    tenantRepository.findById.mockResolvedValue(null);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      userId: 'user-1',
      title: 'Ligar para fornecedor',
      message: 'não esquecer de confirmar entrega',
      frequency: 'ONCE',
      scheduledAt: '2030-04-10T14:00:00.000Z',
    });

    expect(reminderRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        userId: 'user-1',
        title: 'Ligar para fornecedor',
      }),
    );
    expect(reminderQueue.addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        reminderId: result.id,
      }),
    );
    expect(result.branchId).toBe('branch-1');
  });
});
