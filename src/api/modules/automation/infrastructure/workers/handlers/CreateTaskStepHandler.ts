import { Inject, Injectable } from '@nestjs/common';
import {
  TASK_FACADE,
  ITaskFacade,
} from '@modules/task/application/facades/TaskFacade';
import { IStepHandler } from '../../../application/ports/IStepHandler';
import {
  StepExecutionContext,
  StepExecutionResult,
} from '../../../application/ports/IStepExecutor';
import { StepType } from '../../../domain/value-objects/StepType';
import { interpolate } from './interpolate';

@Injectable()
export class CreateTaskStepHandler implements IStepHandler {
  readonly type = StepType.CREATE_TASK;

  constructor(
    @Inject(TASK_FACADE)
    private readonly taskFacade: ITaskFacade,
  ) {}

  async execute(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const title = interpolate(
      (config['title'] as string) || '',
      context.variables,
    ).trim();

    if (!title) {
      return { success: false, error: 'create_task requires a title' };
    }

    const dueInMs = Number(config['dueInMs']);
    const dueAt =
      Number.isFinite(dueInMs) && dueInMs > 0
        ? new Date(Date.now() + dueInMs)
        : null;

    const { taskId } = await this.taskFacade.createTask({
      tenantId: context.tenantId,
      contactId: context.contactId ?? null,
      title,
      dueAt,
    });

    return { success: true, output: { taskCreated: true, taskId, title } };
  }
}
