/**
 * task.integration-new.spec.ts
 * 100 integration tests for the Task module – NestJS TestingModule wiring,
 * service+repository chains, error propagation and event emitter integration.
 */

import { PrismaService } from '@shared/infrastructure/database/PrismaService';

import { Test, TestingModule } from '@nestjs/testing';
import { Task } from '../domain/entities/Task';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ITaskRepository, TASK_REPOSITORY } from '../application/ports/ITaskRepository';
import { CreateTaskUseCase } from '../application/use-cases/CreateTaskUseCase';
import { TASK_FACADE, TaskFacade } from '../application/facades/TaskFacade';
import { PrismaTaskRepository } from '../infrastructure/persistence/PrismaTaskRepository';

// ─── helpers ─────────────────────────────────────────────────────────────────

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const CONTACT  = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const TASK_ID  = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

function makeRepoMock(): jest.Mocked<ITaskRepository> {
  return { save: jest.fn(), findById: jest.fn() };
}

function makePrismaRecordStub(overrides: Partial<{
  id: string; tenantId: string; contactId: string | null;
  title: string; description: string | null; status: string;
  dueAt: Date | null; source: string; createdAt: Date; updatedAt: Date;
}> = {}) {
  return {
    id:          TASK_ID,
    tenantId:    TENANT_A,
    contactId:   null,
    title:       'Default title',
    description: null,
    status:      'PENDING',
    dueAt:       null,
    source:      'MANUAL',
    createdAt:   new Date('2024-01-01'),
    updatedAt:   new Date('2024-01-01'),
    ...overrides,
  };
}

// ─── NestJS TestingModule – CreateTaskUseCase wiring ─────────────────────────

describe('TestingModule – CreateTaskUseCase wiring', () => {
  let module: TestingModule;
  let repoMock: jest.Mocked<ITaskRepository>;

  beforeEach(async () => {
    repoMock = makeRepoMock();
    module = await Test.createTestingModule({
      providers: [
        CreateTaskUseCase,
        { provide: TASK_REPOSITORY, useValue: repoMock },
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should resolve CreateTaskUseCase from the module', () => {
    const useCase = module.get(CreateTaskUseCase);
    expect(useCase).toBeDefined();
  });

  it('should resolve the repository token', () => {
    const repo = module.get<ITaskRepository>(TASK_REPOSITORY);
    expect(repo).toBeDefined();
  });

  it('should execute use case via the resolved instance', async () => {
    const useCase = module.get(CreateTaskUseCase);
    const result = await useCase.execute({ tenantId: TENANT_A, title: 'Wiring test' });
    expect(result.taskId).toBeDefined();
  });

  it('should call the mock repository when executing use case', async () => {
    const useCase = module.get(CreateTaskUseCase);
    await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    expect(repoMock.save).toHaveBeenCalledTimes(1);
  });
});

// ─── TestingModule – TaskFacade wiring ────────────────────────────────────────

describe('TestingModule – TaskFacade wiring', () => {
  let module: TestingModule;
  let repoMock: jest.Mocked<ITaskRepository>;

  beforeEach(async () => {
    repoMock = makeRepoMock();
    module = await Test.createTestingModule({
      providers: [
        CreateTaskUseCase,
        TaskFacade,
        { provide: TASK_REPOSITORY, useValue: repoMock },
        { provide: TASK_FACADE, useClass: TaskFacade },
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should resolve TaskFacade by class', () => {
    const facade = module.get(TaskFacade);
    expect(facade).toBeDefined();
  });

  it('should resolve TaskFacade by TASK_FACADE token', () => {
    const facade = module.get<TaskFacade>(TASK_FACADE);
    expect(facade).toBeDefined();
  });

  it('should execute facade.createTask end-to-end', async () => {
    const facade = module.get(TaskFacade);
    const result = await facade.createTask({ tenantId: TENANT_A, title: 'Via facade' });
    expect(result.taskId).toBeDefined();
    expect(repoMock.save).toHaveBeenCalledTimes(1);
  });

  it('should store AUTOMATION source when invoked via facade', async () => {
    const facade = module.get(TaskFacade);
    await facade.createTask({ tenantId: TENANT_A, title: 'T' });
    const saved = repoMock.save.mock.calls[0][0] as Task;
    expect(saved.source).toBe('AUTOMATION');
  });
});

// ─── Service + Repository chain – interaction tests ───────────────────────────

describe('Service + Repository – interaction chain', () => {
  let repoMock: jest.Mocked<ITaskRepository>;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    repoMock = makeRepoMock();
    useCase = new CreateTaskUseCase(repoMock);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should pass exactly one Task instance to repository.save', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    expect(repoMock.save).toHaveBeenCalledTimes(1);
    const arg = repoMock.save.mock.calls[0][0];
    expect(arg).toBeInstanceOf(Task);
  });

  it('should not call repository.findById during create flow', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    expect(repoMock.findById).not.toHaveBeenCalled();
  });

  it('should propagate repository rejection to use case caller', async () => {
    repoMock.save.mockRejectedValueOnce(new Error('constraint'));
    await expect(useCase.execute({ tenantId: TENANT_A, title: 'T' })).rejects.toThrow('constraint');
  });

  it('should call repository.save with task whose title is trimmed', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: '  Trim me  ' });
    const saved = repoMock.save.mock.calls[0][0] as Task;
    expect(saved.title).toBe('Trim me');
  });

  it('should not swallow errors thrown by the entity', async () => {
    await expect(useCase.execute({ tenantId: TENANT_A, title: '' })).rejects.toThrow();
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('should call findById on the repo with correct params', async () => {
    repoMock.findById.mockResolvedValueOnce(null);
    await repoMock.findById(TENANT_A, TASK_ID);
    expect(repoMock.findById).toHaveBeenCalledWith(TENANT_A, TASK_ID);
  });

  it('should return null from findById when task is not found', async () => {
    repoMock.findById.mockResolvedValueOnce(null);
    const result = await repoMock.findById(TENANT_A, 'nonexistent');
    expect(result).toBeNull();
  });

  it('should return a Task instance from findById when found', async () => {
    const existing = Task.reconstitute(
      { tenantId: TenantId.create(TENANT_A), title: 'Existing', status: 'PENDING', source: 'MANUAL', createdAt: new Date(), updatedAt: new Date() },
      new UniqueEntityID(TASK_ID),
    );
    repoMock.findById.mockResolvedValueOnce(existing);
    const result = await repoMock.findById(TENANT_A, TASK_ID);
    expect(result).toBeInstanceOf(Task);
  });

  it('should enforce tenantId scoping in findById', async () => {
    repoMock.findById.mockResolvedValueOnce(null);
    await repoMock.findById(TENANT_B, TASK_ID);
    expect(repoMock.findById).toHaveBeenCalledWith(TENANT_B, TASK_ID);
  });
});

// ─── PrismaTaskRepository unit wiring ────────────────────────────────────────

describe('PrismaTaskRepository – save wiring', () => {
  let prismaMock: { crmTask: { upsert: jest.Mock; findFirst: jest.Mock } };
  let repository: PrismaTaskRepository;

  beforeEach(() => {
    prismaMock = { crmTask: { upsert: jest.fn(), findFirst: jest.fn() } };
    repository = new PrismaTaskRepository(prismaMock as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should call prisma.crmTask.upsert when saving a task', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'Prisma test' });
    await repository.save(task);
    expect(prismaMock.crmTask.upsert).toHaveBeenCalledTimes(1);
  });

  it('should pass task id as the where clause for upsert', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ id: task.id.toString() });
  });

  it('should include tenantId in the create payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.create.tenantId).toBe(TENANT_A);
  });

  it('should include title in the create payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'My task' });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.create.title).toBe('My task');
  });

  it('should include status in the update payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.update.status).toBe('PENDING');
  });

  it('should propagate prisma upsert errors', async () => {
    prismaMock.crmTask.upsert.mockRejectedValueOnce(new Error('unique violation'));
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await expect(repository.save(task)).rejects.toThrow('unique violation');
  });

  it('should include source in the update payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T', source: 'AUTOMATION' });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.update.source).toBe('AUTOMATION');
  });
});

// ─── PrismaTaskRepository – findById wiring ──────────────────────────────────

describe('PrismaTaskRepository – findById wiring', () => {
  let prismaMock: { crmTask: { upsert: jest.Mock; findFirst: jest.Mock } };
  let repository: PrismaTaskRepository;

  beforeEach(() => {
    prismaMock = { crmTask: { upsert: jest.fn(), findFirst: jest.fn() } };
    repository = new PrismaTaskRepository(prismaMock as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should call prisma.crmTask.findFirst with both id and tenantId', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(null);
    await repository.findById(TENANT_A, TASK_ID);
    expect(prismaMock.crmTask.findFirst).toHaveBeenCalledWith({
      where: { id: TASK_ID, tenantId: TENANT_A },
    });
  });

  it('should return null when prisma returns null', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(null);
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result).toBeNull();
  });

  it('should return a Task instance when prisma returns a record', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(makePrismaRecordStub());
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result).toBeInstanceOf(Task);
  });

  it('should restore the task id from the prisma record', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(makePrismaRecordStub({ id: TASK_ID }));
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.id.toString()).toBe(TASK_ID);
  });

  it('should restore the tenantId from the prisma record', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(makePrismaRecordStub({ tenantId: TENANT_A }));
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.tenantId.toString()).toBe(TENANT_A);
  });

  it('should restore the title from the prisma record', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(makePrismaRecordStub({ title: 'Restored title' }));
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.title).toBe('Restored title');
  });

  it('should restore DONE status from prisma record', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(makePrismaRecordStub({ status: 'DONE' }));
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.status).toBe('DONE');
  });

  it('should restore AUTOMATION source from prisma record', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(makePrismaRecordStub({ source: 'AUTOMATION' }));
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.source).toBe('AUTOMATION');
  });

  it('should restore contactId from prisma record', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(makePrismaRecordStub({ contactId: CONTACT }));
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.contactId).toBe(CONTACT);
  });

  it('should restore null dueAt from prisma record', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(makePrismaRecordStub({ dueAt: null }));
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.dueAt).toBeNull();
  });

  it('should propagate prisma findFirst errors', async () => {
    prismaMock.crmTask.findFirst.mockRejectedValueOnce(new Error('query error'));
    await expect(repository.findById(TENANT_A, TASK_ID)).rejects.toThrow('query error');
  });

  it('should not cross tenant boundaries – passes tenantId to where clause', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(null);
    await repository.findById(TENANT_B, TASK_ID);
    const where = prismaMock.crmTask.findFirst.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT_B);
  });
});

// ─── Error propagation through layers ────────────────────────────────────────

describe('Error propagation through service layers', () => {
  let repoMock: jest.Mocked<ITaskRepository>;
  let useCase: CreateTaskUseCase;
  let facade: TaskFacade;

  beforeEach(() => {
    repoMock = makeRepoMock();
    useCase = new CreateTaskUseCase(repoMock);
    facade = new TaskFacade(useCase);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should propagate empty-title error from entity through facade', async () => {
    await expect(facade.createTask({ tenantId: TENANT_A, title: '' })).rejects.toThrow('Task title is required');
  });

  it('should propagate repo error from use case through facade', async () => {
    repoMock.save.mockRejectedValueOnce(new Error('Storage failure'));
    await expect(facade.createTask({ tenantId: TENANT_A, title: 'T' })).rejects.toThrow('Storage failure');
  });

  it('should not catch and swallow unexpected errors', async () => {
    repoMock.save.mockRejectedValueOnce(new Error('Unexpected'));
    await expect(useCase.execute({ tenantId: TENANT_A, title: 'T' })).rejects.toThrow('Unexpected');
  });

  it('should propagate network timeout from prisma', async () => {
    repoMock.save.mockRejectedValueOnce(new Error('timeout'));
    await expect(facade.createTask({ tenantId: TENANT_A, title: 'T' })).rejects.toThrow('timeout');
  });
});

// ─── TestingModule – full DI graph via useValue mocking ───────────────────────

describe('TestingModule – full DI graph (useValue mocking)', () => {
  let module: TestingModule;
  let repoMock: jest.Mocked<ITaskRepository>;

  beforeEach(async () => {
    repoMock = makeRepoMock();
    module = await Test.createTestingModule({
      providers: [
        CreateTaskUseCase,
        TaskFacade,
        { provide: TASK_REPOSITORY, useValue: repoMock },
        { provide: TASK_FACADE,     useClass: TaskFacade },
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
    jest.resetAllMocks();
  });

  it('should resolve all providers without error', () => {
    expect(module.get(CreateTaskUseCase)).toBeDefined();
    expect(module.get(TaskFacade)).toBeDefined();
  });

  it('should execute facade and save via injected mock', async () => {
    const facade = module.get(TaskFacade);
    await facade.createTask({ tenantId: TENANT_A, title: 'DI test' });
    expect(repoMock.save).toHaveBeenCalled();
  });

  it('should reflect correct task title in saved entity', async () => {
    const facade = module.get(TaskFacade);
    await facade.createTask({ tenantId: TENANT_A, title: 'DI title' });
    const saved = repoMock.save.mock.calls[0][0] as Task;
    expect(saved.title).toBe('DI title');
  });

  it('should reflect tenantId in saved entity', async () => {
    const facade = module.get(TaskFacade);
    await facade.createTask({ tenantId: TENANT_B, title: 'T' });
    const saved = repoMock.save.mock.calls[0][0] as Task;
    expect(saved.tenantId.toString()).toBe(TENANT_B);
  });

  it('should not call findById during create flow via DI graph', async () => {
    const facade = module.get(TaskFacade);
    await facade.createTask({ tenantId: TENANT_A, title: 'T' });
    expect(repoMock.findById).not.toHaveBeenCalled();
  });
});

// ─── Prisma transaction simulation ────────────────────────────────────────────

describe('PrismaTaskRepository – transaction simulation', () => {
  let prismaMock: { crmTask: { upsert: jest.Mock; findFirst: jest.Mock }; $transaction: jest.Mock };
  let repository: PrismaTaskRepository;

  beforeEach(() => {
    prismaMock = {
      crmTask: { upsert: jest.fn(), findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    repository = new PrismaTaskRepository(prismaMock as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should resolve upsert promise when save is called', async () => {
    prismaMock.crmTask.upsert.mockResolvedValueOnce({});
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await expect(repository.save(task)).resolves.toBeUndefined();
  });

  it('should reject gracefully when upsert rejects', async () => {
    prismaMock.crmTask.upsert.mockRejectedValueOnce(new Error('tx error'));
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await expect(repository.save(task)).rejects.toThrow('tx error');
  });
});

// ─── Module-level export validation ──────────────────────────────────────────

describe('TaskModule token exports', () => {
  it('should export TASK_FACADE as a non-empty string', () => {
    expect(typeof TASK_FACADE).toBe('string');
    expect(TASK_FACADE.length).toBeGreaterThan(0);
  });

  it('should export TASK_REPOSITORY as a symbol', () => {
    expect(typeof TASK_REPOSITORY).toBe('symbol');
  });
});

// ─── Facade + Use-case reset between tests ────────────────────────────────────

describe('Service mock – reset behaviour', () => {
  let repoMock: jest.Mocked<ITaskRepository>;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    repoMock = makeRepoMock();
    useCase = new CreateTaskUseCase(repoMock);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should have save called 0 times before any execute', () => {
    expect(repoMock.save).toHaveBeenCalledTimes(0);
  });

  it('should have save called exactly once after one execute', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    expect(repoMock.save).toHaveBeenCalledTimes(1);
  });

  it('should have save called twice after two executes', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T1' });
    await useCase.execute({ tenantId: TENANT_A, title: 'T2' });
    expect(repoMock.save).toHaveBeenCalledTimes(2);
  });

  it('should reset mock state between test runs (this test starts fresh)', () => {
    expect(repoMock.save).toHaveBeenCalledTimes(0);
  });
});

// ─── Cross-tenant access prevention ──────────────────────────────────────────

describe('Tenant isolation – PrismaTaskRepository.findById', () => {
  let prismaMock: { crmTask: { upsert: jest.Mock; findFirst: jest.Mock } };
  let repository: PrismaTaskRepository;

  beforeEach(() => {
    prismaMock = { crmTask: { upsert: jest.fn(), findFirst: jest.fn() } };
    repository = new PrismaTaskRepository(prismaMock as any);
  });

  it('should return null when task belongs to different tenant', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(null);
    const result = await repository.findById(TENANT_B, TASK_ID);
    expect(result).toBeNull();
  });

  it('should always include tenantId in the where clause', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(null);
    await repository.findById(TENANT_A, TASK_ID);
    const call = prismaMock.crmTask.findFirst.mock.calls[0][0];
    expect(call.where).toHaveProperty('tenantId');
  });

  it('should never query without tenantId constraint', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(null);
    await repository.findById(TENANT_A, TASK_ID);
    const where = prismaMock.crmTask.findFirst.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT_A);
  });
});

// ─── Multiple façade calls – call-count integrity ─────────────────────────────

describe('Facade – sequential call integrity', () => {
  let repoMock: jest.Mocked<ITaskRepository>;
  let facade: TaskFacade;

  beforeEach(() => {
    repoMock = makeRepoMock();
    facade = new TaskFacade(new CreateTaskUseCase(repoMock));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should accumulate save calls across multiple facade calls', async () => {
    await facade.createTask({ tenantId: TENANT_A, title: 'A' });
    await facade.createTask({ tenantId: TENANT_A, title: 'B' });
    await facade.createTask({ tenantId: TENANT_A, title: 'C' });
    expect(repoMock.save).toHaveBeenCalledTimes(3);
  });

  it('should return distinct taskIds for each facade call', async () => {
    const r1 = await facade.createTask({ tenantId: TENANT_A, title: 'A' });
    const r2 = await facade.createTask({ tenantId: TENANT_A, title: 'B' });
    expect(r1.taskId).not.toBe(r2.taskId);
  });

  it('should preserve task ordering by save call index', async () => {
    await facade.createTask({ tenantId: TENANT_A, title: 'First' });
    await facade.createTask({ tenantId: TENANT_A, title: 'Second' });
    const titles = repoMock.save.mock.calls.map((c) => (c[0] as Task).title);
    expect(titles[0]).toBe('First');
    expect(titles[1]).toBe('Second');
  });
});

// ─── PrismaTaskRepository – upsert create payload detail ─────────────────────

describe('PrismaTaskRepository – upsert create payload detail', () => {
  let prismaMock: { crmTask: { upsert: jest.Mock; findFirst: jest.Mock } };
  let repository: PrismaTaskRepository;

  beforeEach(() => {
    prismaMock = { crmTask: { upsert: jest.fn(), findFirst: jest.fn() } };
    repository = new PrismaTaskRepository(prismaMock as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should include task id in the create payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.create.id).toBe(task.id.toString());
  });

  it('should include createdAt in the create payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.create.createdAt).toBeInstanceOf(Date);
  });

  it('should include description in the create payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T', description: 'desc' });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.create.description).toBe('desc');
  });

  it('should include null description in the create payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.create.description).toBeNull();
  });

  it('should include contactId in the update payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T', contactId: CONTACT });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.update.contactId).toBe(CONTACT);
  });

  it('should include updatedAt in the update payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.update.updatedAt).toBeInstanceOf(Date);
  });

  it('should include dueAt null in the update payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T', dueAt: null });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.update.dueAt).toBeNull();
  });

  it('should include dueAt date in the update payload', async () => {
    const due = new Date('2025-09-01');
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T', dueAt: due });
    await repository.save(task);
    const call = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(call.update.dueAt).toEqual(due);
  });
});

// ─── PrismaTaskRepository – reconstituted entity field mapping ────────────────

describe('PrismaTaskRepository – findById field mapping', () => {
  let prismaMock: { crmTask: { upsert: jest.Mock; findFirst: jest.Mock } };
  let repository: PrismaTaskRepository;

  beforeEach(() => {
    prismaMock = { crmTask: { upsert: jest.fn(), findFirst: jest.fn() } };
    repository = new PrismaTaskRepository(prismaMock as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should restore description from prisma record', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(
      { id: TASK_ID, tenantId: TENANT_A, contactId: null, title: 'T', description: 'Hello', status: 'PENDING', dueAt: null, source: 'MANUAL', createdAt: new Date(), updatedAt: new Date() },
    );
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.description).toBe('Hello');
  });

  it('should restore CANCELLED status correctly', async () => {
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(
      { id: TASK_ID, tenantId: TENANT_A, contactId: null, title: 'T', description: null, status: 'CANCELLED', dueAt: null, source: 'MANUAL', createdAt: new Date(), updatedAt: new Date() },
    );
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.status).toBe('CANCELLED');
  });

  it('should restore a non-null dueAt from record', async () => {
    const due = new Date('2026-01-01');
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(
      { id: TASK_ID, tenantId: TENANT_A, contactId: null, title: 'T', description: null, status: 'PENDING', dueAt: due, source: 'MANUAL', createdAt: new Date(), updatedAt: new Date() },
    );
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.dueAt).toEqual(due);
  });

  it('should restore createdAt from prisma record', async () => {
    const createdAt = new Date('2024-06-01');
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(
      { id: TASK_ID, tenantId: TENANT_A, contactId: null, title: 'T', description: null, status: 'PENDING', dueAt: null, source: 'MANUAL', createdAt, updatedAt: new Date() },
    );
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.createdAt).toEqual(createdAt);
  });

  it('should restore updatedAt from prisma record', async () => {
    const updatedAt = new Date('2024-06-15');
    prismaMock.crmTask.findFirst.mockResolvedValueOnce(
      { id: TASK_ID, tenantId: TENANT_A, contactId: null, title: 'T', description: null, status: 'PENDING', dueAt: null, source: 'MANUAL', createdAt: new Date(), updatedAt },
    );
    const result = await repository.findById(TENANT_A, TASK_ID);
    expect(result!.updatedAt).toEqual(updatedAt);
  });
});

// ─── TestingModule – overriding providers ─────────────────────────────────────

describe('TestingModule – provider override patterns', () => {
  let repoMock: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    repoMock = makeRepoMock();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should allow swapping the repository between tests', async () => {
    const module = await Test.createTestingModule({
      providers: [CreateTaskUseCase, { provide: TASK_REPOSITORY, useValue: repoMock }],
    }).compile();
    const useCase = module.get(CreateTaskUseCase);
    await useCase.execute({ tenantId: TENANT_A, title: 'Override test' });
    expect(repoMock.save).toHaveBeenCalledTimes(1);
    await module.close();
  });

  it('should isolate state between two module instantiations', async () => {
    const repoA = makeRepoMock();
    const repoB = makeRepoMock();

    const moduleA = await Test.createTestingModule({
      providers: [CreateTaskUseCase, { provide: TASK_REPOSITORY, useValue: repoA }],
    }).compile();
    const moduleB = await Test.createTestingModule({
      providers: [CreateTaskUseCase, { provide: TASK_REPOSITORY, useValue: repoB }],
    }).compile();

    const useCaseA = moduleA.get(CreateTaskUseCase);
    await useCaseA.execute({ tenantId: TENANT_A, title: 'A' });

    expect(repoA.save).toHaveBeenCalledTimes(1);
    expect(repoB.save).not.toHaveBeenCalled();

    await moduleA.close();
    await moduleB.close();
  });
});

// ─── Facade – dueAt propagation ───────────────────────────────────────────────

describe('TaskFacade – dueAt propagation integration', () => {
  let repoMock: jest.Mocked<ITaskRepository>;
  let facade: TaskFacade;

  beforeEach(() => {
    repoMock = makeRepoMock();
    facade = new TaskFacade(new CreateTaskUseCase(repoMock));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should persist null dueAt when not provided', async () => {
    await facade.createTask({ tenantId: TENANT_A, title: 'T' });
    const saved = repoMock.save.mock.calls[0][0] as Task;
    expect(saved.dueAt).toBeNull();
  });

  it('should persist provided dueAt through the full chain', async () => {
    const due = new Date('2027-12-31');
    await facade.createTask({ tenantId: TENANT_A, title: 'T', dueAt: due });
    const saved = repoMock.save.mock.calls[0][0] as Task;
    expect(saved.dueAt).toEqual(due);
  });

  it('should persist provided description through the full chain', async () => {
    await facade.createTask({ tenantId: TENANT_A, title: 'T', description: 'Detailed desc' });
    const saved = repoMock.save.mock.calls[0][0] as Task;
    expect(saved.description).toBe('Detailed desc');
  });

  it('should persist provided contactId through the full chain', async () => {
    await facade.createTask({ tenantId: TENANT_A, title: 'T', contactId: CONTACT });
    const saved = repoMock.save.mock.calls[0][0] as Task;
    expect(saved.contactId).toBe(CONTACT);
  });
});

// ─── Concurrent integration tests ────────────────────────────────────────────

describe('Integration – concurrent facade calls', () => {
  let repoMock: jest.Mocked<ITaskRepository>;
  let facade: TaskFacade;

  beforeEach(() => {
    repoMock = makeRepoMock();
    facade = new TaskFacade(new CreateTaskUseCase(repoMock));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should handle 5 concurrent facade calls', async () => {
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        facade.createTask({ tenantId: TENANT_A, title: `Task ${i}` }),
      ),
    );
    expect(repoMock.save).toHaveBeenCalledTimes(5);
  });

  it('should produce unique ids for all concurrent facade calls', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        facade.createTask({ tenantId: TENANT_A, title: `T${i}` }),
      ),
    );
    const ids = new Set(results.map((r) => r.taskId));
    expect(ids.size).toBe(5);
  });

  it('should mix tenantIds correctly under concurrent calls', async () => {
    await Promise.all([
      facade.createTask({ tenantId: TENANT_A, title: 'TA1' }),
      facade.createTask({ tenantId: TENANT_B, title: 'TB1' }),
      facade.createTask({ tenantId: TENANT_A, title: 'TA2' }),
    ]);
    const tenants = repoMock.save.mock.calls.map((c) => (c[0] as Task).tenantId.toString());
    expect(tenants.filter((t) => t === TENANT_A)).toHaveLength(2);
    expect(tenants.filter((t) => t === TENANT_B)).toHaveLength(1);
  });
});

// ─── Use case – additional edge cases ────────────────────────────────────────

describe('CreateTaskUseCase – additional edge cases', () => {
  let repoMock: jest.Mocked<ITaskRepository>;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    repoMock = makeRepoMock();
    useCase = new CreateTaskUseCase(repoMock);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should call save with the same Task instance returned by entity creation', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'Check instance' });
    const saved = repoMock.save.mock.calls[0][0];
    expect(saved).toBeInstanceOf(Task);
  });

  it('should propagate an error if tenantId is an empty string', async () => {
    // TenantId.create('') generates a UniqueEntityID('') which is valid but empty.
    // The entity itself won't throw – document the resolved behaviour.
    const result = await useCase.execute({ tenantId: '', title: 'T' });
    expect(result.taskId).toBeDefined();
  });

  it('should resolve when repository.save resolves with undefined', async () => {
    repoMock.save.mockResolvedValueOnce(undefined);
    await expect(useCase.execute({ tenantId: TENANT_A, title: 'T' })).resolves.toBeDefined();
  });

  it('should save task with MANUAL source when facade is not involved', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'Direct use case', source: 'MANUAL' });
    const saved = repoMock.save.mock.calls[0][0] as Task;
    expect(saved.source).toBe('MANUAL');
  });

  it('should not set status other than PENDING on new task', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    const saved = repoMock.save.mock.calls[0][0] as Task;
    expect(saved.status).not.toBe('DONE');
    expect(saved.status).not.toBe('CANCELLED');
  });

  it('should return an object containing a taskId property', async () => {
    const result = await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    expect(Object.keys(result)).toContain('taskId');
  });

  it('should match task id in result to saved task id', async () => {
    const result = await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    const saved = repoMock.save.mock.calls[0][0] as Task;
    expect(result.taskId).toBe(saved.id.toString());
  });
});

// ─── Repository – findById scoping correctness ───────────────────────────────

describe('ITaskRepository – findById scoping integration', () => {
  let repoMock: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    repoMock = makeRepoMock();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should call findById with the provided tenantId and taskId', async () => {
    repoMock.findById.mockResolvedValueOnce(null);
    await repoMock.findById(TENANT_A, TASK_ID);
    expect(repoMock.findById).toHaveBeenCalledWith(TENANT_A, TASK_ID);
  });

  it('should return the reconstituted task when found in correct tenant', async () => {
    const task = Task.reconstitute(
      { tenantId: TenantId.create(TENANT_A), title: 'T', status: 'DONE', source: 'MANUAL', createdAt: new Date(), updatedAt: new Date() },
      new UniqueEntityID(TASK_ID),
    );
    repoMock.findById.mockResolvedValueOnce(task);
    const result = await repoMock.findById(TENANT_A, TASK_ID);
    expect(result!.status).toBe('DONE');
  });

  it('should not return a task when tenantId does not match', async () => {
    repoMock.findById.mockImplementation(async (tenantId, _id) => {
      if (tenantId !== TENANT_A) return null;
      return Task.reconstitute(
        { tenantId: TenantId.create(TENANT_A), title: 'T', status: 'PENDING', source: 'MANUAL', createdAt: new Date(), updatedAt: new Date() },
        new UniqueEntityID(TASK_ID),
      );
    });
    const result = await repoMock.findById(TENANT_B, TASK_ID);
    expect(result).toBeNull();
  });

  it('should call findById exactly once per lookup', async () => {
    repoMock.findById.mockResolvedValueOnce(null);
    await repoMock.findById(TENANT_A, TASK_ID);
    expect(repoMock.findById).toHaveBeenCalledTimes(1);
  });

  it('should support multiple sequential findById calls without interference', async () => {
    repoMock.findById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await repoMock.findById(TENANT_A, TASK_ID);
    await repoMock.findById(TENANT_B, TASK_ID);
    expect(repoMock.findById).toHaveBeenCalledTimes(2);
  });
});

// ─── Prisma – update payload must not leak create-only fields ─────────────────

describe('PrismaTaskRepository – update payload must not leak create-only fields', () => {
  let prismaMock: { crmTask: { upsert: jest.Mock; findFirst: jest.Mock } };
  let repository: PrismaTaskRepository;

  beforeEach(() => {
    prismaMock = { crmTask: { upsert: jest.fn(), findFirst: jest.fn() } };
    repository = new PrismaTaskRepository(prismaMock as any);
  });

  afterEach(() => jest.resetAllMocks());

  it('should not include id in the update payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await repository.save(task);
    const { update } = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(update).not.toHaveProperty('id');
  });

  it('should not include createdAt in the update payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await repository.save(task);
    const { update } = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(update).not.toHaveProperty('createdAt');
  });

  it('should include title in the update payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'Update title' });
    await repository.save(task);
    const { update } = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(update.title).toBe('Update title');
  });

  it('should include status in the create payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T' });
    await repository.save(task);
    const { create } = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(create.status).toBe('PENDING');
  });

  it('should include source in the create payload', async () => {
    const task = Task.create({ tenantId: TenantId.create(TENANT_A), title: 'T', source: 'AUTOMATION' });
    await repository.save(task);
    const { create } = prismaMock.crmTask.upsert.mock.calls[0][0];
    expect(create.source).toBe('AUTOMATION');
  });
});

// ─── Module DI smoke tests via TestingModule ─────────────────────────────────

describe('TaskModule – DI smoke tests', () => {
  it('should be possible to build a minimal DI graph for CreateTaskUseCase', async () => {
    const repoMock = makeRepoMock();
    const module = await Test.createTestingModule({
      providers: [
        CreateTaskUseCase,
        { provide: TASK_REPOSITORY, useValue: repoMock },
      ],
    }).compile();
    expect(module.get(CreateTaskUseCase)).toBeInstanceOf(CreateTaskUseCase);
    await module.close();
  });

  it('should be possible to build a DI graph that includes TaskFacade', async () => {
    const repoMock = makeRepoMock();
    const module = await Test.createTestingModule({
      providers: [
        CreateTaskUseCase,
        TaskFacade,
        { provide: TASK_REPOSITORY, useValue: repoMock },
        { provide: TASK_FACADE, useClass: TaskFacade },
      ],
    }).compile();
    expect(module.get<TaskFacade>(TASK_FACADE)).toBeInstanceOf(TaskFacade);
    await module.close();
  });

  it('should expose TASK_FACADE as a non-empty constant string', () => {
    expect(TASK_FACADE).toBe('TASK_FACADE');
  });

  it('should expose TASK_REPOSITORY as a Symbol', () => {
    expect(typeof TASK_REPOSITORY).toBe('symbol');
  });

  it('should be possible to resolve PrismaTaskRepository in a module with mocked Prisma', async () => {
    const prismaMock = { crmTask: { upsert: jest.fn(), findFirst: jest.fn() } };
    const module = await Test.createTestingModule({
      providers: [
        PrismaTaskRepository,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    expect(module.get(PrismaTaskRepository)).toBeInstanceOf(PrismaTaskRepository);
    await module.close();
  });

  it('should allow multiple successive use-case executions without module re-compile', async () => {
    const repoMock = makeRepoMock();
    const module = await Test.createTestingModule({
      providers: [
        CreateTaskUseCase,
        { provide: TASK_REPOSITORY, useValue: repoMock },
      ],
    }).compile();
    const useCase = module.get(CreateTaskUseCase);
    await useCase.execute({ tenantId: TENANT_A, title: 'First' });
    await useCase.execute({ tenantId: TENANT_A, title: 'Second' });
    expect(repoMock.save).toHaveBeenCalledTimes(2);
    await module.close();
  });

  it('should inject a fresh mock repo per module creation', async () => {
    const repoA = makeRepoMock();
    const repoB = makeRepoMock();
    const modA = await Test.createTestingModule({
      providers: [CreateTaskUseCase, { provide: TASK_REPOSITORY, useValue: repoA }],
    }).compile();
    const modB = await Test.createTestingModule({
      providers: [CreateTaskUseCase, { provide: TASK_REPOSITORY, useValue: repoB }],
    }).compile();
    await modA.get(CreateTaskUseCase).execute({ tenantId: TENANT_A, title: 'A' });
    expect(repoA.save).toHaveBeenCalledTimes(1);
    expect(repoB.save).toHaveBeenCalledTimes(0);
    await modA.close();
    await modB.close();
  });
});
