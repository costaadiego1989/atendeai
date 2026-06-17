import { Task } from '../../domain/entities/Task';

export interface ITaskRepository {
  save(task: Task): Promise<void>;
  findById(tenantId: string, id: string): Promise<Task | null>;
}

export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');
