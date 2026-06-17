import { CreateTaskUseCase } from '../application/use-cases/CreateTaskUseCase';
import { ITaskRepository } from '../application/ports/ITaskRepository';
import { Task } from '../domain/entities/Task';
import { TaskFacade } from '../application/facades/TaskFacade';

describe('Task domain', () => {
  it('Task.create requires a non-empty title', () => {
    expect(() =>
      Task.create({ tenantId: { toString: () => 't1' } as any, title: '  ' }),
    ).toThrow('Task title is required');
  });
});

describe('CreateTaskUseCase', () => {
  let repo: jest.Mocked<ITaskRepository>;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    repo = { save: jest.fn(), findById: jest.fn() };
    useCase = new CreateTaskUseCase(repo);
  });

  it('persists a task scoped to the tenant and returns its id', async () => {
    const out = await useCase.execute({
      tenantId: '11111111-1111-1111-1111-111111111111',
      contactId: 'c1',
      title: 'Ligar para cliente',
      source: 'AUTOMATION',
    });

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0] as Task;
    expect(saved.tenantId.toString()).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(saved.title).toBe('Ligar para cliente');
    expect(saved.source).toBe('AUTOMATION');
    expect(saved.status).toBe('PENDING');
    expect(out.taskId).toBe(saved.id.toString());
  });
});

describe('TaskFacade', () => {
  it('delegates to the use case forcing AUTOMATION source', async () => {
    const execute = jest.fn().mockResolvedValue({ taskId: 't1' });
    const facade = new TaskFacade({ execute } as any);

    const out = await facade.createTask({
      tenantId: 't1',
      title: 'X',
      contactId: 'c1',
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'AUTOMATION', title: 'X' }),
    );
    expect(out.taskId).toBe('t1');
  });
});
