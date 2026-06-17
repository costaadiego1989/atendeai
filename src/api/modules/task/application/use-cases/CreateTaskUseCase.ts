import { Inject, Injectable } from '@nestjs/common';
import { TenantId } from '@shared/domain/TenantId';
import { Task, TaskSource } from '../../domain/entities/Task';
import { ITaskRepository, TASK_REPOSITORY } from '../ports/ITaskRepository';

export interface CreateTaskInput {
  tenantId: string;
  contactId?: string | null;
  title: string;
  description?: string | null;
  dueAt?: Date | null;
  source?: TaskSource;
}

export interface CreateTaskOutput {
  taskId: string;
}

@Injectable()
export class CreateTaskUseCase {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(input: CreateTaskInput): Promise<CreateTaskOutput> {
    const task = Task.create({
      tenantId: TenantId.create(input.tenantId),
      contactId: input.contactId ?? null,
      title: input.title,
      description: input.description ?? null,
      dueAt: input.dueAt ?? null,
      source: input.source ?? 'MANUAL',
    });

    await this.taskRepository.save(task);

    return { taskId: task.id.toString() };
  }
}
