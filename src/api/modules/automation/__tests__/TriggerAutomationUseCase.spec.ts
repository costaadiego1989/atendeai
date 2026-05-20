import { TriggerAutomationUseCase } from '../application/use-cases/TriggerAutomationUseCase';
import { ExecuteAutomationUseCase } from '../application/use-cases/ExecuteAutomationUseCase';
import { IAutomationRepository } from '../application/ports/IAutomationRepository';
import { AutomationEntity } from '../domain/entities/Automation';
import { TriggerType } from '../domain/value-objects/TriggerType';

describe('TriggerAutomationUseCase', () => {
  let useCase: TriggerAutomationUseCase;
  let repository: jest.Mocked<IAutomationRepository>;
  let executeUseCase: jest.Mocked<ExecuteAutomationUseCase>;

  const makeAutomation = (id: string): AutomationEntity => ({
    id,
    tenantId: 'tenant-1',
    name: `Automation ${id}`,
    description: null,
    isActive: true,
    trigger: { type: TriggerType.CONTACT_CREATED, config: {} },
    conditions: [],
    steps: [{ id: 's1', automationId: id, order: 0, type: 'send_message', config: {}, nextStepId: null }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
      findByTriggerType: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      toggleActive: jest.fn(),
    } as any;

    executeUseCase = {
      execute: jest.fn(),
    } as any;

    useCase = new TriggerAutomationUseCase(repository, executeUseCase);
  });

  it('should find and execute matching automations', async () => {
    const automations = [makeAutomation('auto-1'), makeAutomation('auto-2')];
    repository.findByTriggerType.mockResolvedValue(automations);
    executeUseCase.execute
      .mockResolvedValueOnce('exec-1')
      .mockResolvedValueOnce('exec-2');

    const result = await useCase.execute(
      'tenant-1',
      TriggerType.CONTACT_CREATED,
      { name: 'João' },
      'contact-1',
    );

    expect(result).toEqual(['exec-1', 'exec-2']);
    expect(repository.findByTriggerType).toHaveBeenCalledWith('tenant-1', TriggerType.CONTACT_CREATED);
    expect(executeUseCase.execute).toHaveBeenCalledTimes(2);
  });

  it('should return empty array when no automations match', async () => {
    repository.findByTriggerType.mockResolvedValue([]);

    const result = await useCase.execute(
      'tenant-1',
      TriggerType.TAG_ADDED,
      { tag: 'vip' },
    );

    expect(result).toEqual([]);
    expect(executeUseCase.execute).not.toHaveBeenCalled();
  });

  it('should not block other automations when one fails', async () => {
    const automations = [makeAutomation('auto-1'), makeAutomation('auto-2'), makeAutomation('auto-3')];
    repository.findByTriggerType.mockResolvedValue(automations);
    executeUseCase.execute
      .mockResolvedValueOnce('exec-1')
      .mockRejectedValueOnce(new Error('Step executor crashed'))
      .mockResolvedValueOnce('exec-3');

    const result = await useCase.execute(
      'tenant-1',
      TriggerType.MESSAGE_RECEIVED,
      { text: 'hello' },
      'contact-1',
    );

    // Should still return the successful executions
    expect(result).toEqual(['exec-1', 'exec-3']);
    expect(executeUseCase.execute).toHaveBeenCalledTimes(3);
  });

  it('should filter out empty execution IDs', async () => {
    repository.findByTriggerType.mockResolvedValue([makeAutomation('auto-1')]);
    // Empty string means automation was inactive or conditions not met
    executeUseCase.execute.mockResolvedValue('');

    const result = await useCase.execute(
      'tenant-1',
      TriggerType.PAYMENT_OVERDUE,
      { amount: 100 },
    );

    expect(result).toEqual([]);
  });
});
