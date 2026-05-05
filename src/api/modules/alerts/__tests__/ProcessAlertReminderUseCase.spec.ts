import { ProcessAlertReminderUseCase } from '../application/use-cases/ProcessAlertReminderUseCase';
import { stubAlertReminderRuntimeConfig } from './alert-reminder-runtime.stub';

describe('ProcessAlertReminderUseCase', () => {
  let reminderRepository: any;
  let reminderQueue: any;
  let contactFacade: any;
  let messagingFacade: any;
  let sut: ProcessAlertReminderUseCase;

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
      ensureContact: jest.fn(),
    };
    messagingFacade = {
      queueSystemMessage: jest.fn(),
    };

    sut = new ProcessAlertReminderUseCase(
      reminderRepository,
      reminderQueue,
      contactFacade,
      messagingFacade,
      stubAlertReminderRuntimeConfig(),
    );
  });

  it('should propagate branchId when processing a branch-scoped reminder', async () => {
    reminderRepository.findById.mockResolvedValue({
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
    });
    contactFacade.ensureContact.mockResolvedValue({
      contactId: 'contact-1',
      created: true,
    });
    messagingFacade.queueSystemMessage.mockResolvedValue({
      messageId: 'message-1',
      conversationId: 'conversation-1',
    });

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
    reminderRepository.findById.mockResolvedValue({
      id: 'reminder-x',
      tenantId: 'tenant-1',
      branchId: null,
      timezone: 'UTC',
      userId: 'user-1',
      userName: 'Paulo',
      userPhone: '5599999999999',
      userEmail: undefined,
      title: 'Teste',
      message: 'msg',
      frequency: 'ONCE',
      nextTriggerAt: new Date(Date.now() - 2000).toISOString(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await localSut.execute({ tenantId: 'tenant-1', reminderId: 'reminder-x' });

    expect(contactFacade.ensureContact).not.toHaveBeenCalled();
    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
    expect(reminderRepository.save).toHaveBeenCalled();
  });
});
