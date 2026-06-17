import { StepExecutionContext, StepExecutionResult } from './IStepExecutor';

/**
 * Strategy contract: one handler per automation step type.
 * Handlers are registered in the module and dispatched by {@link CompositeStepExecutor}
 * keyed on {@link IStepHandler.type}, keeping each step's logic isolated and
 * independently testable (SRP/OCP).
 */
export interface IStepHandler {
  readonly type: string;
  execute(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult>;
}

/** Multi-provider token: resolves to IStepHandler[]. */
export const STEP_HANDLERS = Symbol('STEP_HANDLERS');
