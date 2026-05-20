/**
 * Port for executing automation step actions.
 * Each step type has a corresponding executor.
 */
export const STEP_EXECUTOR = Symbol('STEP_EXECUTOR');

export interface StepExecutionContext {
  tenantId: string;
  automationId: string;
  executionId: string;
  contactId?: string;
  variables: Record<string, unknown>;
}

export interface StepExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  nextStepId?: string | null;
  error?: string;
}

export interface IStepExecutor {
  execute(
    stepType: string,
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult>;
}
