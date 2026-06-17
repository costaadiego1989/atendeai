import { Injectable } from '@nestjs/common';
import { CreateTaskUseCase } from '../use-cases/CreateTaskUseCase';

export interface ITaskFacade {
  createTask(input: {
    tenantId: string;
    contactId?: string | null;
    title: string;
    description?: string | null;
    dueAt?: Date | null;
  }): Promise<{ taskId: string }>;
}

export const TASK_FACADE = 'TASK_FACADE';

@Injectable()
export class TaskFacade implements ITaskFacade {
  constructor(private readonly createTaskUseCase: CreateTaskUseCase) {}

  async createTask(input: {
    tenantId: string;
    contactId?: string | null;
    title: string;
    description?: string | null;
    dueAt?: Date | null;
  }): Promise<{ taskId: string }> {
    return this.createTaskUseCase.execute({
      ...input,
      source: 'AUTOMATION',
    });
  }
}
