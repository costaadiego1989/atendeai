import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ExecuteAutomationUseCase } from '../application/use-cases/ExecuteAutomationUseCase';
import { TriggerAutomationUseCase } from '../application/use-cases/TriggerAutomationUseCase';
import {
  AUTOMATION_REPOSITORY,
  IAutomationRepository,
  AUTOMATION_EXECUTION_REPOSITORY,
  IAutomationExecutionRepository,
} from '../application/ports/IAutomationRepository';
import { TriggerType } from '../domain/value-objects/TriggerType';

describe('Automation Execution Pipeline (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let executeUseCase: ExecuteAutomationUseCase;
  let triggerUseCase: TriggerAutomationUseCase;
  let repository: IAutomationRepository;
  let executionRepo: IAutomationExecutionRepository;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    executeUseCase = app.get(ExecuteAutomationUseCase);
    triggerUseCase = app.get(TriggerAutomationUseCase);
    repository = app.get<IAutomationRepository>(AUTOMATION_REPOSITORY);
    executionRepo = app.get<IAutomationExecutionRepository>(AUTOMATION_EXECUTION_REPOSITORY);

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Automation Pipeline Test',
        cnpj: `ap${Date.now()}`.slice(-14),
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await prisma.automationExecution.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.automationStep.deleteMany({ where: { automation: { tenantId } } }).catch(() => {});
    await prisma.automation.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await app.close();
  });

  describe('ExecuteAutomationUseCase with real DB', () => {
    let automationId: string;

    beforeAll(async () => {
      const automation = await repository.create({
        tenantId,
        name: 'Pipeline Test Automation',
        description: 'Tests full execution pipeline',
        isActive: true,
        trigger: { type: TriggerType.CONTACT_CREATED, config: {} },
        conditions: [{ field: 'stage', operator: 'equals', value: 'LEAD' }],
        steps: [
          { id: '', automationId: '', order: 0, type: 'send_message', config: { body: 'Welcome {{name}}!' }, nextStepId: null },
          { id: '', automationId: '', order: 1, type: 'add_tag', config: { tag: 'welcomed' }, nextStepId: null },
          { id: '', automationId: '', order: 2, type: 'update_contact', config: { fields: { notes: 'Auto-welcomed' } }, nextStepId: null },
        ],
      });
      automationId = automation.id;
    });

    it('should execute all steps and create a COMPLETED execution record', async () => {
      const executionId = await executeUseCase.execute({
        tenantId,
        automationId,
        contactId: '00000000-0000-0000-0000-000000000001',
        triggerPayload: { name: 'João', stage: 'LEAD' },
      });

      expect(executionId).toBeDefined();
      expect(executionId.length).toBeGreaterThan(0);

      // Verify execution record
      const execution = await executionRepo.findById(executionId);
      expect(execution).not.toBeNull();
      expect(execution!.status).toBe('COMPLETED');
      expect(execution!.automationId).toBe(automationId);
      expect(execution!.tenantId).toBe(tenantId);
      expect(execution!.contactId).toBe('00000000-0000-0000-0000-000000000001');
      expect(execution!.completedAt).toBeInstanceOf(Date);
    });

    it('should skip execution when conditions are not met', async () => {
      const executionId = await executeUseCase.execute({
        tenantId,
        automationId,
        contactId: '00000000-0000-0000-0000-000000000002',
        triggerPayload: { name: 'Maria', stage: 'CUSTOMER' }, // Not LEAD
      });

      // Empty string means conditions not met
      expect(executionId).toBe('');
    });

    it('should skip execution when automation is inactive', async () => {
      await repository.toggleActive(tenantId, automationId, false);

      const executionId = await executeUseCase.execute({
        tenantId,
        automationId,
        contactId: '00000000-0000-0000-0000-000000000003',
        triggerPayload: { name: 'Pedro', stage: 'LEAD' },
      });

      expect(executionId).toBe('');

      // Re-activate for next tests
      await repository.toggleActive(tenantId, automationId, true);
    });
  });

  describe('TriggerAutomationUseCase with real DB', () => {
    let autoId1: string;
    let autoId2: string;

    beforeAll(async () => {
      const auto1 = await repository.create({
        tenantId,
        name: 'Trigger Test 1',
        description: null,
        isActive: true,
        trigger: { type: TriggerType.TAG_ADDED, config: {} },
        conditions: [],
        steps: [
          { id: '', automationId: '', order: 0, type: 'send_message', config: { body: 'Tag added!' }, nextStepId: null },
        ],
      });
      autoId1 = auto1.id;

      const auto2 = await repository.create({
        tenantId,
        name: 'Trigger Test 2',
        description: null,
        isActive: true,
        trigger: { type: TriggerType.TAG_ADDED, config: {} },
        conditions: [],
        steps: [
          { id: '', automationId: '', order: 0, type: 'add_tag', config: { tag: 'processed' }, nextStepId: null },
        ],
      });
      autoId2 = auto2.id;
    });

    it('should find and execute all matching automations', async () => {
      const executionIds = await triggerUseCase.execute(
        tenantId,
        TriggerType.TAG_ADDED,
        { tag: 'vip', contactId: '00000000-0000-0000-0000-000000000004' },
        '00000000-0000-0000-0000-000000000004',
      );

      expect(executionIds.length).toBe(2);

      // Verify both executions completed
      for (const execId of executionIds) {
        const exec = await executionRepo.findById(execId);
        expect(exec!.status).toBe('COMPLETED');
      }
    });

    it('should return empty when no automations match trigger type', async () => {
      const executionIds = await triggerUseCase.execute(
        tenantId,
        TriggerType.ORDER_PLACED,
        { orderId: 'order-1' },
      );

      expect(executionIds).toEqual([]);
    });

    it('should isolate triggers by tenant', async () => {
      const executionIds = await triggerUseCase.execute(
        '00000000-0000-0000-0000-000000000000',
        TriggerType.TAG_ADDED,
        { tag: 'vip' },
      );

      expect(executionIds).toEqual([]);
    });
  });
});
