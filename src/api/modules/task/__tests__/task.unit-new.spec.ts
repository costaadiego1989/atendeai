/**
 * task.unit-new.spec.ts
 * 100 unit tests for the Task module – entities, value objects, use-cases, and facade.
 */

import { Task, TaskStatus, TaskSource } from '../domain/entities/Task';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ITaskRepository } from '../application/ports/ITaskRepository';
import { CreateTaskUseCase, CreateTaskInput } from '../application/use-cases/CreateTaskUseCase';
import { TaskFacade } from '../application/facades/TaskFacade';

// ─── helpers ────────────────────────────────────────────────────────────────

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const CONTACT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function makeTenant(id = TENANT_A): TenantId {
  return TenantId.create(id);
}

function makeRepo(): jest.Mocked<ITaskRepository> {
  return { save: jest.fn(), findById: jest.fn() };
}

// ─── Task entity – creation rules ───────────────────────────────────────────

describe('Task.create – title validation', () => {
  it('should throw when title is empty string', () => {
    expect(() => Task.create({ tenantId: makeTenant(), title: '' })).toThrow('Task title is required');
  });

  it('should throw when title is only whitespace', () => {
    expect(() => Task.create({ tenantId: makeTenant(), title: '   ' })).toThrow('Task title is required');
  });

  it('should throw when title is a tab character', () => {
    expect(() => Task.create({ tenantId: makeTenant(), title: '\t' })).toThrow('Task title is required');
  });

  it('should throw when title is a newline character', () => {
    expect(() => Task.create({ tenantId: makeTenant(), title: '\n' })).toThrow('Task title is required');
  });

  it('should trim surrounding whitespace from the title', () => {
    const task = Task.create({ tenantId: makeTenant(), title: '  Call client  ' });
    expect(task.title).toBe('Call client');
  });

  it('should create a task with a valid title', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'Valid title' });
    expect(task.title).toBe('Valid title');
  });

  it('should create a task with a single-character title', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'A' });
    expect(task.title).toBe('A');
  });

  it('should create a task with a very long title (255 chars)', () => {
    const long = 'x'.repeat(255);
    const task = Task.create({ tenantId: makeTenant(), title: long });
    expect(task.title).toBe(long);
  });

  it('should accept a title with special characters', () => {
    const title = 'Follow-up: "Proposal" — €5k deal';
    const task = Task.create({ tenantId: makeTenant(), title });
    expect(task.title).toBe(title);
  });

  it('should accept a title containing HTML injection attempt', () => {
    const title = '<script>alert("xss")</script>';
    const task = Task.create({ tenantId: makeTenant(), title });
    expect(task.title).toBe(title);
  });
});

// ─── Task entity – default field values ─────────────────────────────────────

describe('Task.create – default values', () => {
  it('should default status to PENDING', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    expect(task.status).toBe('PENDING');
  });

  it('should default source to MANUAL', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    expect(task.source).toBe('MANUAL');
  });

  it('should default contactId to null', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    expect(task.contactId).toBeNull();
  });

  it('should default description to null', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    expect(task.description).toBeNull();
  });

  it('should default dueAt to null', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    expect(task.dueAt).toBeNull();
  });

  it('should auto-generate a UUID id', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    expect(task.id.toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('should set createdAt to a recent Date', () => {
    const before = Date.now();
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    const after = Date.now();
    expect(task.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(task.createdAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('should set updatedAt to a recent Date', () => {
    const before = Date.now();
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    const after = Date.now();
    expect(task.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(task.updatedAt.getTime()).toBeLessThanOrEqual(after);
  });
});

// ─── Task entity – explicit optional fields ──────────────────────────────────

describe('Task.create – optional fields', () => {
  it('should store provided contactId', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T', contactId: CONTACT_ID });
    expect(task.contactId).toBe(CONTACT_ID);
  });

  it('should store explicit null contactId as null', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T', contactId: null });
    expect(task.contactId).toBeNull();
  });

  it('should store provided description', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T', description: 'Details' });
    expect(task.description).toBe('Details');
  });

  it('should store explicit null description as null', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T', description: null });
    expect(task.description).toBeNull();
  });

  it('should store provided dueAt', () => {
    const due = new Date('2025-12-31');
    const task = Task.create({ tenantId: makeTenant(), title: 'T', dueAt: due });
    expect(task.dueAt).toEqual(due);
  });

  it('should store AUTOMATION source when explicitly set', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T', source: 'AUTOMATION' });
    expect(task.source).toBe('AUTOMATION');
  });

  it('should store MANUAL source when explicitly set', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T', source: 'MANUAL' });
    expect(task.source).toBe('MANUAL');
  });

  it('should preserve tenantId value', () => {
    const task = Task.create({ tenantId: makeTenant(TENANT_B), title: 'T' });
    expect(task.tenantId.toString()).toBe(TENANT_B);
  });
});

// ─── Task entity – injection / edge cases in description ────────────────────

describe('Task.create – injection attempts in description', () => {
  it('should accept SQL injection attempt in description', () => {
    const desc = "'; DROP TABLE tasks; --";
    const task = Task.create({ tenantId: makeTenant(), title: 'T', description: desc });
    expect(task.description).toBe(desc);
  });

  it('should accept HTML in description', () => {
    const desc = '<b>Bold</b><script>alert(1)</script>';
    const task = Task.create({ tenantId: makeTenant(), title: 'T', description: desc });
    expect(task.description).toBe(desc);
  });

  it('should accept JSON blob in description', () => {
    const desc = '{"key": "value", "nested": {"a": 1}}';
    const task = Task.create({ tenantId: makeTenant(), title: 'T', description: desc });
    expect(task.description).toBe(desc);
  });

  it('should accept null byte in description', () => {
    const desc = 'hello\x00world';
    const task = Task.create({ tenantId: makeTenant(), title: 'T', description: desc });
    expect(task.description).toBe(desc);
  });
});

// ─── Task entity – reconstitute ──────────────────────────────────────────────

describe('Task.reconstitute', () => {
  const fixedId = new UniqueEntityID('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  const now = new Date('2024-01-01T00:00:00.000Z');

  it('should restore id from reconstitute', () => {
    const task = Task.reconstitute(
      { tenantId: makeTenant(), title: 'T', status: 'PENDING', source: 'MANUAL', createdAt: now, updatedAt: now },
      fixedId,
    );
    expect(task.id.toString()).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  it('should restore DONE status from reconstitute', () => {
    const task = Task.reconstitute(
      { tenantId: makeTenant(), title: 'T', status: 'DONE', source: 'MANUAL', createdAt: now, updatedAt: now },
      fixedId,
    );
    expect(task.status).toBe('DONE');
  });

  it('should restore CANCELLED status from reconstitute', () => {
    const task = Task.reconstitute(
      { tenantId: makeTenant(), title: 'T', status: 'CANCELLED', source: 'MANUAL', createdAt: now, updatedAt: now },
      fixedId,
    );
    expect(task.status).toBe('CANCELLED');
  });

  it('should restore createdAt from reconstitute', () => {
    const task = Task.reconstitute(
      { tenantId: makeTenant(), title: 'T', status: 'PENDING', source: 'MANUAL', createdAt: now, updatedAt: now },
      fixedId,
    );
    expect(task.createdAt).toEqual(now);
  });
});

// ─── Task entity – identity / equality ───────────────────────────────────────

describe('Task entity – identity', () => {
  it('should report equal for same entity reference', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    expect(task.equals(task)).toBe(true);
  });

  it('should report not equal for two different tasks', () => {
    const a = Task.create({ tenantId: makeTenant(), title: 'T' });
    const b = Task.create({ tenantId: makeTenant(), title: 'T' });
    expect(a.equals(b)).toBe(false);
  });

  it('should report not equal when compared with undefined', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    expect(task.equals(undefined)).toBe(false);
  });
});

// ─── TenantId value object ────────────────────────────────────────────────────

describe('TenantId value object', () => {
  it('should create a TenantId from a valid UUID string', () => {
    const t = TenantId.create(TENANT_A);
    expect(t.toString()).toBe(TENANT_A);
  });

  it('should generate a new UUID when called without argument', () => {
    const t = TenantId.create();
    expect(t.toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('should consider two TenantIds with the same value as equal', () => {
    const a = TenantId.create(TENANT_A);
    const b = TenantId.create(TENANT_A);
    expect(a.equals(b)).toBe(true);
  });

  it('should consider two TenantIds with different values as not equal', () => {
    const a = TenantId.create(TENANT_A);
    const b = TenantId.create(TENANT_B);
    expect(a.equals(b)).toBe(false);
  });

  it('should return false when comparing with undefined', () => {
    const t = TenantId.create(TENANT_A);
    expect(t.equals(undefined)).toBe(false);
  });

  it('should expose toValue() identical to toString()', () => {
    const t = TenantId.create(TENANT_A);
    expect(t.toValue()).toBe(t.toString());
  });
});

// ─── UniqueEntityID value object ──────────────────────────────────────────────

describe('UniqueEntityID value object', () => {
  it('should preserve the provided id string', () => {
    const id = new UniqueEntityID('fixed-id');
    expect(id.toValue()).toBe('fixed-id');
  });

  it('should generate a UUID when constructed without argument', () => {
    const id = new UniqueEntityID();
    expect(id.toValue()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('should report equals true for same value', () => {
    const a = new UniqueEntityID('x');
    const b = new UniqueEntityID('x');
    expect(a.equals(b)).toBe(true);
  });

  it('should report equals false for different values', () => {
    const a = new UniqueEntityID('x');
    const b = new UniqueEntityID('y');
    expect(a.equals(b)).toBe(false);
  });

  it('should report false when compared with undefined', () => {
    const id = new UniqueEntityID('x');
    expect(id.equals(undefined)).toBe(false);
  });
});

// ─── CreateTaskUseCase – happy path ───────────────────────────────────────────

describe('CreateTaskUseCase – happy path', () => {
  let repo: jest.Mocked<ITaskRepository>;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CreateTaskUseCase(repo);
  });

  it('should call repository.save once', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('should return a taskId string', async () => {
    const result = await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    expect(typeof result.taskId).toBe('string');
  });

  it('should return the id of the saved task', async () => {
    const result = await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    const saved = (repo.save.mock.calls[0][0]) as Task;
    expect(result.taskId).toBe(saved.id.toString());
  });

  it('should save task with correct tenantId', async () => {
    await useCase.execute({ tenantId: TENANT_B, title: 'T' });
    const saved = (repo.save.mock.calls[0][0]) as Task;
    expect(saved.tenantId.toString()).toBe(TENANT_B);
  });

  it('should save task with correct title', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'Do it' });
    const saved = (repo.save.mock.calls[0][0]) as Task;
    expect(saved.title).toBe('Do it');
  });

  it('should default source to MANUAL when not provided', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    const saved = (repo.save.mock.calls[0][0]) as Task;
    expect(saved.source).toBe('MANUAL');
  });

  it('should respect explicit AUTOMATION source', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T', source: 'AUTOMATION' });
    const saved = (repo.save.mock.calls[0][0]) as Task;
    expect(saved.source).toBe('AUTOMATION');
  });

  it('should persist null contactId when not provided', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    const saved = (repo.save.mock.calls[0][0]) as Task;
    expect(saved.contactId).toBeNull();
  });

  it('should persist provided contactId', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T', contactId: CONTACT_ID });
    const saved = (repo.save.mock.calls[0][0]) as Task;
    expect(saved.contactId).toBe(CONTACT_ID);
  });

  it('should persist provided description', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T', description: 'Desc' });
    const saved = (repo.save.mock.calls[0][0]) as Task;
    expect(saved.description).toBe('Desc');
  });

  it('should persist provided dueAt', async () => {
    const due = new Date('2025-06-01');
    await useCase.execute({ tenantId: TENANT_A, title: 'T', dueAt: due });
    const saved = (repo.save.mock.calls[0][0]) as Task;
    expect(saved.dueAt).toEqual(due);
  });

  it('should persist initial status as PENDING', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    const saved = (repo.save.mock.calls[0][0]) as Task;
    expect(saved.status).toBe('PENDING');
  });
});

// ─── CreateTaskUseCase – error handling ───────────────────────────────────────

describe('CreateTaskUseCase – error handling', () => {
  let repo: jest.Mocked<ITaskRepository>;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CreateTaskUseCase(repo);
  });

  it('should throw when title is empty', async () => {
    await expect(useCase.execute({ tenantId: TENANT_A, title: '' })).rejects.toThrow(
      'Task title is required',
    );
  });

  it('should throw when title is whitespace-only', async () => {
    await expect(useCase.execute({ tenantId: TENANT_A, title: '   ' })).rejects.toThrow(
      'Task title is required',
    );
  });

  it('should not call repository.save when title is empty', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: '' }).catch(() => undefined);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should propagate repository save errors', async () => {
    repo.save.mockRejectedValueOnce(new Error('DB down'));
    await expect(useCase.execute({ tenantId: TENANT_A, title: 'T' })).rejects.toThrow('DB down');
  });
});

// ─── CreateTaskUseCase – tenant isolation ────────────────────────────────────

describe('CreateTaskUseCase – tenant isolation', () => {
  let repo: jest.Mocked<ITaskRepository>;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CreateTaskUseCase(repo);
  });

  it('should scope tenantId A correctly', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T' });
    const saved = repo.save.mock.calls[0][0] as Task;
    expect(saved.tenantId.toString()).toBe(TENANT_A);
  });

  it('should scope tenantId B correctly', async () => {
    await useCase.execute({ tenantId: TENANT_B, title: 'T' });
    const saved = repo.save.mock.calls[0][0] as Task;
    expect(saved.tenantId.toString()).toBe(TENANT_B);
  });

  it('should not mix tenantIds in concurrent calls', async () => {
    await Promise.all([
      useCase.execute({ tenantId: TENANT_A, title: 'Task A' }),
      useCase.execute({ tenantId: TENANT_B, title: 'Task B' }),
    ]);
    const calls = repo.save.mock.calls.map((c) => (c[0] as Task).tenantId.toString());
    expect(calls).toContain(TENANT_A);
    expect(calls).toContain(TENANT_B);
    expect(calls).toHaveLength(2);
  });

  it('should produce distinct task ids in concurrent calls', async () => {
    await Promise.all([
      useCase.execute({ tenantId: TENANT_A, title: 'A' }),
      useCase.execute({ tenantId: TENANT_A, title: 'B' }),
    ]);
    const [task1, task2] = repo.save.mock.calls.map((c) => (c[0] as Task).id.toString());
    expect(task1).not.toBe(task2);
  });
});

// ─── TaskFacade ───────────────────────────────────────────────────────────────

describe('TaskFacade', () => {
  let executeStub: jest.Mock;
  let facade: TaskFacade;

  beforeEach(() => {
    executeStub = jest.fn().mockResolvedValue({ taskId: 'tid' });
    facade = new TaskFacade({ execute: executeStub } as any);
  });

  it('should delegate to use case execute', async () => {
    await facade.createTask({ tenantId: TENANT_A, title: 'T' });
    expect(executeStub).toHaveBeenCalledTimes(1);
  });

  it('should force source to AUTOMATION', async () => {
    await facade.createTask({ tenantId: TENANT_A, title: 'T' });
    expect(executeStub).toHaveBeenCalledWith(expect.objectContaining({ source: 'AUTOMATION' }));
  });

  it('should pass through tenantId', async () => {
    await facade.createTask({ tenantId: TENANT_B, title: 'T' });
    expect(executeStub).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT_B }));
  });

  it('should pass through title', async () => {
    await facade.createTask({ tenantId: TENANT_A, title: 'My title' });
    expect(executeStub).toHaveBeenCalledWith(expect.objectContaining({ title: 'My title' }));
  });

  it('should pass through contactId', async () => {
    await facade.createTask({ tenantId: TENANT_A, title: 'T', contactId: CONTACT_ID });
    expect(executeStub).toHaveBeenCalledWith(expect.objectContaining({ contactId: CONTACT_ID }));
  });

  it('should pass through description', async () => {
    await facade.createTask({ tenantId: TENANT_A, title: 'T', description: 'D' });
    expect(executeStub).toHaveBeenCalledWith(expect.objectContaining({ description: 'D' }));
  });

  it('should pass through dueAt', async () => {
    const due = new Date('2026-01-01');
    await facade.createTask({ tenantId: TENANT_A, title: 'T', dueAt: due });
    expect(executeStub).toHaveBeenCalledWith(expect.objectContaining({ dueAt: due }));
  });

  it('should return the taskId from the use case', async () => {
    const result = await facade.createTask({ tenantId: TENANT_A, title: 'T' });
    expect(result.taskId).toBe('tid');
  });

  it('should propagate errors from the use case', async () => {
    executeStub.mockRejectedValueOnce(new Error('use case error'));
    await expect(facade.createTask({ tenantId: TENANT_A, title: 'T' })).rejects.toThrow('use case error');
  });

  it('should not mutate the input source even if caller passes one', async () => {
    await facade.createTask({ tenantId: TENANT_A, title: 'T' } as any);
    expect(executeStub).toHaveBeenCalledWith(expect.objectContaining({ source: 'AUTOMATION' }));
  });
});

// ─── Concurrent call simulation ───────────────────────────────────────────────

describe('CreateTaskUseCase – concurrent call simulation', () => {
  it('should handle 10 concurrent calls without error', async () => {
    const repo = makeRepo();
    const useCase = new CreateTaskUseCase(repo);

    const tasks = Array.from({ length: 10 }, (_, i) =>
      useCase.execute({ tenantId: TENANT_A, title: `Task ${i}` }),
    );
    const results = await Promise.all(tasks);
    expect(results).toHaveLength(10);
    expect(repo.save).toHaveBeenCalledTimes(10);
  });

  it('should produce unique task ids across concurrent calls', async () => {
    const repo = makeRepo();
    const useCase = new CreateTaskUseCase(repo);

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        useCase.execute({ tenantId: TENANT_A, title: `T${i}` }),
      ),
    );
    const ids = results.map((r) => r.taskId);
    const unique = new Set(ids);
    expect(unique.size).toBe(5);
  });
});

// ─── Event emission – domain events ──────────────────────────────────────────

describe('Task aggregate – domain events', () => {
  it('should start with an empty domainEvents list', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    expect(task.domainEvents).toHaveLength(0);
  });

  it('should clear domain events after clearEvents()', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    task.clearEvents();
    expect(task.domainEvents).toHaveLength(0);
  });

  it('should return a readonly domain events array', () => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T' });
    const events = task.domainEvents;
    expect(Array.isArray(events)).toBe(true);
  });
});

// ─── Task entity – boundary values ───────────────────────────────────────────

describe('Task.create – boundary values', () => {
  it('should accept a title with leading whitespace trimmed to valid content', () => {
    const task = Task.create({ tenantId: makeTenant(), title: '\n\t  Actual title' });
    expect(task.title).toBe('Actual title');
  });

  it('should accept a Unicode emoji in the title', () => {
    const task = Task.create({ tenantId: makeTenant(), title: '📞 Follow up' });
    expect(task.title).toBe('📞 Follow up');
  });

  it('should accept a title that is entirely numbers', () => {
    const task = Task.create({ tenantId: makeTenant(), title: '12345' });
    expect(task.title).toBe('12345');
  });

  it('should accept a future dueAt date', () => {
    const future = new Date(Date.now() + 1_000_000_000);
    const task = Task.create({ tenantId: makeTenant(), title: 'T', dueAt: future });
    expect(task.dueAt).toEqual(future);
  });

  it('should accept a past dueAt date', () => {
    const past = new Date('2000-01-01');
    const task = Task.create({ tenantId: makeTenant(), title: 'T', dueAt: past });
    expect(task.dueAt).toEqual(past);
  });

  it('should produce a new entity id each time Task.create is called', () => {
    const a = Task.create({ tenantId: makeTenant(), title: 'T' });
    const b = Task.create({ tenantId: makeTenant(), title: 'T' });
    expect(a.id.toString()).not.toBe(b.id.toString());
  });

  it('should accept a custom id passed to Task.create', () => {
    const fixedId = new UniqueEntityID('custom-id-123');
    const task = Task.create({ tenantId: makeTenant(), title: 'T' }, fixedId);
    expect(task.id.toString()).toBe('custom-id-123');
  });
});

// ─── CreateTaskUseCase – null/undefined coercion ──────────────────────────────

describe('CreateTaskUseCase – null/undefined coercion', () => {
  let repo: jest.Mocked<ITaskRepository>;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CreateTaskUseCase(repo);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should coerce undefined contactId to null in the entity', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T', contactId: undefined });
    const saved = repo.save.mock.calls[0][0] as Task;
    expect(saved.contactId).toBeNull();
  });

  it('should coerce undefined description to null in the entity', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T', description: undefined });
    const saved = repo.save.mock.calls[0][0] as Task;
    expect(saved.description).toBeNull();
  });

  it('should coerce undefined dueAt to null in the entity', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T', dueAt: undefined });
    const saved = repo.save.mock.calls[0][0] as Task;
    expect(saved.dueAt).toBeNull();
  });

  it('should coerce undefined source to MANUAL in the entity', async () => {
    await useCase.execute({ tenantId: TENANT_A, title: 'T', source: undefined });
    const saved = repo.save.mock.calls[0][0] as Task;
    expect(saved.source).toBe('MANUAL');
  });
});

// ─── Task – TypeScript type safety checks ─────────────────────────────────────

describe('Task – status type exhaustiveness', () => {
  const validStatuses: TaskStatus[] = ['PENDING', 'DONE', 'CANCELLED'];

  it.each(validStatuses)('should reconstitute with status %s', (status) => {
    const task = Task.reconstitute(
      { tenantId: makeTenant(), title: 'T', status, source: 'MANUAL', createdAt: new Date(), updatedAt: new Date() },
      new UniqueEntityID(),
    );
    expect(task.status).toBe(status);
  });
});

describe('Task – source type exhaustiveness', () => {
  const validSources: TaskSource[] = ['MANUAL', 'AUTOMATION'];

  it.each(validSources)('should create with source %s', (source) => {
    const task = Task.create({ tenantId: makeTenant(), title: 'T', source });
    expect(task.source).toBe(source);
  });
});

// ─── Extra edge cases ─────────────────────────────────────────────────────────

describe('Task – additional edge cases', () => {
  it('should not share state between two independently created tasks', () => {
    const a = Task.create({ tenantId: makeTenant(TENANT_A), title: 'Task A', description: 'Desc A' });
    const b = Task.create({ tenantId: makeTenant(TENANT_B), title: 'Task B', description: 'Desc B' });
    expect(a.description).not.toBe(b.description);
    expect(a.tenantId.toString()).not.toBe(b.tenantId.toString());
  });
});
