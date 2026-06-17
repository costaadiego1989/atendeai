import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IStepExecutor,
  StepExecutionContext,
  StepExecutionResult,
} from '../../application/ports/IStepExecutor';
import {
  IStepHandler,
  STEP_HANDLERS,
} from '../../application/ports/IStepHandler';

/**
 * Dispatches a step to the registered {@link IStepHandler} for its type.
 * Handlers are injected via the STEP_HANDLERS multi-provider, so adding a new
 * step type means adding a handler — no change here (Open/Closed).
 */
@Injectable()
export class CompositeStepExecutor implements IStepExecutor {
  private readonly logger = new Logger(CompositeStepExecutor.name);
  private readonly handlers: Map<string, IStepHandler>;

  constructor(
    @Inject(STEP_HANDLERS)
    handlers: IStepHandler[],
  ) {
    this.handlers = new Map(handlers.map((h) => [h.type, h]));
  }

  async execute(
    stepType: string,
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const handler = this.handlers.get(stepType);
    if (!handler) {
      return { success: false, error: `Unknown step type: ${stepType}` };
    }

    this.logger.debug(
      `Executing step "${stepType}" for execution ${context.executionId}`,
    );

    try {
      return await handler.execute(config, context);
    } catch (error: any) {
      this.logger.error(
        `Step "${stepType}" failed for execution ${context.executionId}: ${error.message}`,
      );
      return { success: false, error: error.message };
    }
  }
}
