import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  AUTOMATION_REPOSITORY,
  IAutomationRepository,
  AUTOMATION_EXECUTION_REPOSITORY,
  IAutomationExecutionRepository,
} from '../application/ports/IAutomationRepository';
import { TriggerType } from '../domain/value-objects/TriggerType';

describe('PrismaAutomationRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let repository: IAutomationRepository;
  let executionRepo: IAutomationExecutionRepository;
  let tenantId: string;
  let automationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    repository = app.get<IAutomationRepository>(AUTOMATION_REPOSITORY);
    executionRepo = app.get<IAutomationExecutionRepository>(AUTOMATION_EXECUTION_REPOSITORY);

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Automation Integration Test',
        cnpj: `${Date.now()}`.slice(-14),
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

  describe('IAutomationRepository', () => {
    it('should create an automation with steps', async () => {
      const result = await repository.create({
        tenantId,
        name: 'Integration Test Flow',
        description: 'Test automation',
        isActive: false,
        trigger: { type: TriggerType.CONTACT_CREATED, config: {} },
        conditions: [{ field: 'stage', operator: 'equals', value: 'LEAD' }],
        steps: [
          { id: '', automationId: '', order: 0, type: 'send_message', config: { body: 'Hello' }, nextStepId: null },
          { id: '', automationId: '', order: 1, type: 'add_tag', config: { tag: 'welcomed' }, nextStepId: null },
        ],
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Integration Test Flow');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].type).toBe('send_message');
      expect(result.steps[1].type).toBe('add_tag');
      automationId = result.id;
    });

    it('should find automation by id scoped to tenant', async () => {
      const found = await repository.findById(tenantId, automationId);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Integration Test Flow');
      expect(found!.conditions).toHaveLength(1);
    });

    it('should return null for wrong tenant', async () => {
      const found = await repository.findById('00000000-0000-0000-0000-000000000000', automationId);
      expect(found).toBeNull();
    });

    it('should list all automations for tenant', async () => {
      const list = await repository.findAllByTenant(tenantId);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((a) => a.id === automationId)).toBe(true);
    });

    it('should filter only active automations', async () => {
      const activeList = await repository.findAllByTenant(tenantId, true);
      expect(activeList.every((a) => a.isActive)).toBe(true);
    });

    it('should find by trigger type (active only)', async () => {
      // Activate the automation first
      await repository.toggleActive(tenantId, automationId, true);

      const found = await repository.findByTriggerType(tenantId, TriggerType.CONTACT_CREATED);
      expect(found.some((a) => a.id === automationId)).toBe(true);
    });

    it('should update automation fields', async () => {
      const updated = await repository.update(tenantId, automationId, {
        name: 'Updated Integration Flow',
        isActive: false,
      });

      expect(updated.name).toBe('Updated Integration Flow');
      expect(updated.isActive).toBe(false);
    });

    it('should update automation steps (replace)', async () => {
      const updated = await repository.update(tenantId, automationId, {
        steps: [
          { id: '', automationId, order: 0, type: 'http_request', config: { url: 'https://hook.example.com' }, nextStepId: null },
        ],
      });

      expect(updated.steps).toHaveLength(1);
      expect(updated.steps[0].type).toBe('http_request');
    });

    it('should delete automation', async () => {
      await repository.delete(tenantId, automationId);
      const found = await repository.findById(tenantId, automationId);
      expect(found).toBeNull();
    });
  });

  describe('IAutomationExecutionRepository', () => {
    let execAutomationId: string;
    let executionId: string;

    beforeAll(async () => {
      const auto = await repository.create({
        tenantId,
        name: 'Execution Test',
        description: null,
        isActive: true,
        trigger: { type: TriggerType.TAG_ADDED, config: {} },
        conditions: [],
        steps: [{ id: '', automationId: '', order: 0, type: 'add_tag', config: { tag: 'test' }, nextStepId: null }],
      });
      execAutomationId = auto.id;
    });

    it('should create an execution record', async () => {
      const exec = await executionRepo.create({
        automationId: execAutomationId,
        tenantId,
        contactId: '00000000-0000-0000-0000-000000000001',
        status: 'RUNNING',
        currentStep: 0,
        context: { triggerPayload: { tag: 'vip' } },
      });

      expect(exec.id).toBeDefined();
      expect(exec.status).toBe('RUNNING');
      expect(exec.startedAt).toBeInstanceOf(Date);
      executionId = exec.id;
    });

    it('should find execution by id', async () => {
      const found = await executionRepo.findById(executionId);
      expect(found).not.toBeNull();
      expect(found!.automationId).toBe(execAutomationId);
    });

    it('should update execution step and context', async () => {
      await executionRepo.updateStep(executionId, 1, { step1Result: 'ok' });
      const found = await executionRepo.findById(executionId);
      expect(found!.currentStep).toBe(1);
      expect(found!.context).toEqual(expect.objectContaining({ step1Result: 'ok' }));
    });

    it('should update execution status to COMPLETED', async () => {
      await executionRepo.updateStatus(executionId, 'COMPLETED');
      const found = await executionRepo.findById(executionId);
      expect(found!.status).toBe('COMPLETED');
      expect(found!.completedAt).toBeInstanceOf(Date);
    });

    it('should find executions by automation', async () => {
      const list = await executionRepo.findByAutomation(tenantId, execAutomationId);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0].automationId).toBe(execAutomationId);
    });

    it('should find running executions', async () => {
      // Create a running execution
      const running = await executionRepo.create({
        automationId: execAutomationId,
        tenantId,
        contactId: null,
        status: 'RUNNING',
        currentStep: 0,
        context: {},
      });

      const runningList = await executionRepo.findRunning(tenantId);
      expect(runningList.some((e) => e.id === running.id)).toBe(true);

      // Cancel it
      await executionRepo.cancel(running.id);
      const cancelled = await executionRepo.findById(running.id);
      expect(cancelled!.status).toBe('CANCELLED');
    });
  });
});
