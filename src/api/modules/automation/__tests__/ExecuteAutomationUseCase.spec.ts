import { ExecuteAutomationUseCase } from '../application/use-cases/ExecuteAutomationUseCase';
import { IAutomationRepository, IAutomationExecutionRepository } from '../application/ports/IAutomationRepository';
import { IStepExecutor } from '../application/ports/IStepExecutor';
import { AutomationEntity } from '../domain/entities/Automation';
import { TriggerType } from '../domain/value-objects/TriggerType';

describe('ExecuteAutomationUseCase', () => {
  let useCase: ExecuteAutomationUseCase;
  let automationRepo: jest.Mocked<IAutomationRepository>;
  let executionRepo: jest.Mocked<IAutomationExecutionRepository>;
  let stepExecutor: jest.Mocked<IStepExecutor>;

  const mockAutomation: AutomationEntity = {
    id: 'auto-1',
    tenantId: 'tenant-1',
    name: 'Test Automation',
    description: null,
    isActive: true,
    trigger: { type: TriggerType.CONTACT_CREATED, config: {} },
    conditions: [],
    steps: [
      { id: 'step-1', automationId: 'auto-1', order: 0, type: 'send_message', config: { body: 'Hi {{name}}' }, nextStepId: null },
      { id: 'step-2', automationId: 'auto-1', order: 1, type: 'add_tag', config: { tag: 'welcomed' }, nextStepId: null },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExecution = {
    id: 'exec-1',
    automationId: 'auto-1',
    tenantId: 'tenant-1',
    contactId: 'contact-1',
    status: 'RUNNING' as const,
    currentStep: 0,
    context: {},
    startedAt: new Date(),
  };

  beforeEach(() => {
    automationRepo = {
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
      findByTriggerType: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      toggleActive: jest.fn(),
    } as any;

    executionRepo = {
      create: jest.fn().mockResolvedValue(mockExecution),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      updateStep: jest.fn(),
      findByAutomation: jest.fn(),
      findRunning: jest.fn(),
      cancel: jest.fn(),
    } as any;

    stepExecutor = {
      execute: jest.fn().mockResolvedValue({ success: true, output: {} }),
    } as any;

    useCase = new ExecuteAutomationUseCase(
      automationRepo,
      executionRepo,
      stepExecutor,
    );
  });

  it('should execute all steps successfully', async () => {
    automationRepo.findById.mockResolvedValue(mockAutomation);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      automationId: 'auto-1',
      contactId: 'contact-1',
      triggerPayload: { name: 'João' },
    });

    expect(result).toBe('exec-1');
    expect(stepExecutor.execute).toHaveBeenCalledTimes(2);
    expect(executionRepo.updateStatus).toHaveBeenCalledWith('exec-1', 'COMPLETED');
  });

  it('should return empty string when automation is inactive', async () => {
    automationRepo.findById.mockResolvedValue({ ...mockAutomation, isActive: false });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      automationId: 'auto-1',
      contactId: 'contact-1',
      triggerPayload: {},
    });

    expect(result).toBe('');
    expect(stepExecutor.execute).not.toHaveBeenCalled();
  });

  it('should return empty string when conditions are not met', async () => {
    const withConditions = {
      ...mockAutomation,
      conditions: [{ field: 'stage', operator: 'equals', value: 'VIP' }],
    };
    automationRepo.findById.mockResolvedValue(withConditions);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      automationId: 'auto-1',
      contactId: 'contact-1',
      triggerPayload: { stage: 'LEAD' },
    });

    expect(result).toBe('');
    expect(executionRepo.create).not.toHaveBeenCalled();
  });

  it('should mark execution as FAILED when a step fails', async () => {
    automationRepo.findById.mockResolvedValue(mockAutomation);
    stepExecutor.execute
      .mockResolvedValueOnce({ success: true, output: {} })
      .mockResolvedValueOnce({ success: false, error: 'Tag service unavailable' });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      automationId: 'auto-1',
      contactId: 'contact-1',
      triggerPayload: {},
    });

    expect(result).toBe('exec-1');
    expect(executionRepo.updateStatus).toHaveBeenCalledWith('exec-1', 'FAILED', 'Tag service unavailable');
  });

  it('should handle branching via nextStepId', async () => {
    const branchingAutomation: AutomationEntity = {
      ...mockAutomation,
      steps: [
        { id: 'step-1', automationId: 'auto-1', order: 0, type: 'condition_branch', config: {}, nextStepId: null },
        { id: 'step-2', automationId: 'auto-1', order: 1, type: 'send_message', config: { body: 'A' }, nextStepId: null },
        { id: 'step-3', automationId: 'auto-1', order: 2, type: 'send_message', config: { body: 'B' }, nextStepId: null },
      ],
    };
    automationRepo.findById.mockResolvedValue(branchingAutomation);

    // First step returns nextStepId pointing to step-3 (skipping step-2)
    stepExecutor.execute
      .mockResolvedValueOnce({ success: true, output: {}, nextStepId: 'step-3' })
      .mockResolvedValueOnce({ success: true, output: {} });

    await useCase.execute({
      tenantId: 'tenant-1',
      automationId: 'auto-1',
      triggerPayload: {},
    });

    // Should have executed step-1 (condition) and step-3 (branch target), skipping step-2
    expect(stepExecutor.execute).toHaveBeenCalledTimes(2);
    expect(stepExecutor.execute).toHaveBeenNthCalledWith(
      2,
      'send_message',
      { body: 'B' },
      expect.anything(),
    );
  });

  it('should throw when automation not found', async () => {
    automationRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        automationId: 'nonexistent',
        triggerPayload: {},
      }),
    ).rejects.toThrow('Automation nonexistent not found');
  });

  it('should evaluate conditions correctly', async () => {
    const withConditions = {
      ...mockAutomation,
      conditions: [
        { field: 'amount', operator: 'gt', value: 100 },
        { field: 'status', operator: 'equals', value: 'active' },
      ],
    };
    automationRepo.findById.mockResolvedValue(withConditions);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      automationId: 'auto-1',
      triggerPayload: { amount: 200, status: 'active' },
    });

    expect(result).toBe('exec-1');
    expect(executionRepo.create).toHaveBeenCalled();
  });

  it('should merge step output into variables for next steps', async () => {
    automationRepo.findById.mockResolvedValue(mockAutomation);
    stepExecutor.execute
      .mockResolvedValueOnce({ success: true, output: { messageSent: true } })
      .mockResolvedValueOnce({ success: true, output: {} });

    await useCase.execute({
      tenantId: 'tenant-1',
      automationId: 'auto-1',
      triggerPayload: { name: 'Test' },
    });

    // Second step should receive merged variables
    expect(stepExecutor.execute).toHaveBeenNthCalledWith(
      2,
      'add_tag',
      { tag: 'welcomed' },
      expect.objectContaining({
        variables: expect.objectContaining({ name: 'Test', messageSent: true }),
      }),
    );
  });
});
