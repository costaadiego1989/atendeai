import { CreateAutomationUseCase } from '../application/use-cases/CreateAutomationUseCase';
import { UpdateAutomationUseCase } from '../application/use-cases/UpdateAutomationUseCase';
import { DeleteAutomationUseCase } from '../application/use-cases/DeleteAutomationUseCase';
import { ListAutomationsUseCase } from '../application/use-cases/ListAutomationsUseCase';
import { IAutomationRepository } from '../application/ports/IAutomationRepository';
import { AutomationEntity } from '../domain/entities/Automation';
import { TriggerType } from '../domain/value-objects/TriggerType';

describe('Automation CRUD Use Cases', () => {
  let repository: jest.Mocked<IAutomationRepository>;

  const mockAutomation: AutomationEntity = {
    id: 'auto-1',
    tenantId: 'tenant-1',
    name: 'Welcome Flow',
    description: 'Sends welcome message on contact creation',
    isActive: false,
    trigger: { type: TriggerType.CONTACT_CREATED, config: {} },
    conditions: [],
    steps: [
      { id: 'step-1', automationId: 'auto-1', order: 0, type: 'send_message', config: { body: 'Hello!' }, nextStepId: null },
    ],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

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
  });

  describe('CreateAutomationUseCase', () => {
    let useCase: CreateAutomationUseCase;

    beforeEach(() => {
      useCase = new CreateAutomationUseCase(repository);
    });

    it('should create an automation successfully', async () => {
      repository.create.mockResolvedValue(mockAutomation);

      const result = await useCase.execute({
        tenantId: 'tenant-1',
        name: 'Welcome Flow',
        description: 'Sends welcome message on contact creation',
        trigger: { type: TriggerType.CONTACT_CREATED, config: {} },
        conditions: [],
        steps: [{ type: 'send_message', config: { body: 'Hello!' }, order: 0 }],
      });

      expect(result).toEqual(mockAutomation);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Welcome Flow',
          isActive: false,
        }),
      );
    });

    it('should default isActive to false', async () => {
      repository.create.mockResolvedValue(mockAutomation);

      await useCase.execute({
        tenantId: 'tenant-1',
        name: 'Test',
        trigger: { type: TriggerType.TAG_ADDED, config: {} },
        steps: [{ type: 'add_tag', config: { tag: 'vip' }, order: 0 }],
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe('UpdateAutomationUseCase', () => {
    let useCase: UpdateAutomationUseCase;

    beforeEach(() => {
      useCase = new UpdateAutomationUseCase(repository);
    });

    it('should update an automation successfully', async () => {
      const updated = { ...mockAutomation, name: 'Updated Flow' };
      repository.findById.mockResolvedValue(mockAutomation);
      repository.update.mockResolvedValue(updated);

      const result = await useCase.execute({
        tenantId: 'tenant-1',
        automationId: 'auto-1',
        name: 'Updated Flow',
      });

      expect(result.name).toBe('Updated Flow');
      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'auto-1',
        expect.objectContaining({ name: 'Updated Flow' }),
      );
    });

    it('should throw when automation not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ tenantId: 'tenant-1', automationId: 'nonexistent' }),
      ).rejects.toThrow('Automation nonexistent not found');
    });

    it('should update isActive field', async () => {
      repository.findById.mockResolvedValue(mockAutomation);
      repository.update.mockResolvedValue({ ...mockAutomation, isActive: true });

      const result = await useCase.execute({
        tenantId: 'tenant-1',
        automationId: 'auto-1',
        isActive: true,
      });

      expect(result.isActive).toBe(true);
    });
  });

  describe('DeleteAutomationUseCase', () => {
    let useCase: DeleteAutomationUseCase;

    beforeEach(() => {
      useCase = new DeleteAutomationUseCase(repository);
    });

    it('should delete an automation successfully', async () => {
      repository.findById.mockResolvedValue(mockAutomation);
      repository.delete.mockResolvedValue(undefined);

      await useCase.execute('tenant-1', 'auto-1');

      expect(repository.delete).toHaveBeenCalledWith('tenant-1', 'auto-1');
    });

    it('should throw when automation not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute('tenant-1', 'nonexistent'),
      ).rejects.toThrow('Automation nonexistent not found');
    });
  });

  describe('ListAutomationsUseCase', () => {
    let useCase: ListAutomationsUseCase;

    beforeEach(() => {
      useCase = new ListAutomationsUseCase(repository);
    });

    it('should list all automations for a tenant', async () => {
      repository.findAllByTenant.mockResolvedValue([mockAutomation]);

      const result = await useCase.execute('tenant-1');

      expect(result).toHaveLength(1);
      expect(repository.findAllByTenant).toHaveBeenCalledWith('tenant-1', undefined);
    });

    it('should filter only active automations', async () => {
      repository.findAllByTenant.mockResolvedValue([]);

      await useCase.execute('tenant-1', true);

      expect(repository.findAllByTenant).toHaveBeenCalledWith('tenant-1', true);
    });
  });
});
