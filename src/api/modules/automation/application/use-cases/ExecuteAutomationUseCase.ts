import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  AUTOMATION_REPOSITORY,
  IAutomationRepository,
  AUTOMATION_EXECUTION_REPOSITORY,
  IAutomationExecutionRepository,
} from '../ports/IAutomationRepository';
import {
  STEP_EXECUTOR,
  IStepExecutor,
  StepExecutionContext,
} from '../ports/IStepExecutor';
import { AutomationEntity } from '../../domain/entities/Automation';

export interface ExecuteAutomationInput {
  tenantId: string;
  automationId: string;
  contactId?: string;
  triggerPayload: Record<string, unknown>;
}

@Injectable()
export class ExecuteAutomationUseCase {
  private readonly logger = new Logger(ExecuteAutomationUseCase.name);
  private readonly MAX_STEPS = 50;

  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automationRepo: IAutomationRepository,
    @Inject(AUTOMATION_EXECUTION_REPOSITORY)
    private readonly executionRepo: IAutomationExecutionRepository,
    @Inject(STEP_EXECUTOR)
    private readonly stepExecutor: IStepExecutor,
  ) {}

  async execute(input: ExecuteAutomationInput): Promise<string> {
    const automation = await this.automationRepo.findById(input.tenantId, input.automationId);
    if (!automation) {
      throw new Error(`Automation ${input.automationId} not found`);
    }

    if (!automation.isActive) {
      this.logger.warn(`Automation ${input.automationId} is not active, skipping`);
      return '';
    }

    // Check conditions
    if (!this.evaluateConditions(automation, input.triggerPayload)) {
      this.logger.debug(`Conditions not met for automation ${input.automationId}`);
      return '';
    }

    // Create execution record
    const execution = await this.executionRepo.create({
      automationId: input.automationId,
      tenantId: input.tenantId,
      contactId: input.contactId || null,
      status: 'RUNNING',
      currentStep: 0,
      context: { triggerPayload: input.triggerPayload },
    });

    this.logger.log(`Starting execution ${execution.id} for automation ${automation.name}`);

    // Execute steps sequentially
    const sortedSteps = [...automation.steps].sort((a, b) => a.order - b.order);
    let stepIndex = 0;
    let variables: Record<string, unknown> = { ...input.triggerPayload };

    try {
      while (stepIndex < sortedSteps.length && stepIndex < this.MAX_STEPS) {
        const step = sortedSteps[stepIndex];

        await this.executionRepo.updateStep(execution.id, stepIndex, variables);

        const context: StepExecutionContext = {
          tenantId: input.tenantId,
          automationId: input.automationId,
          executionId: execution.id,
          contactId: input.contactId,
          variables,
        };

        const result = await this.stepExecutor.execute(step.type, step.config, context);

        if (!result.success) {
          await this.executionRepo.updateStatus(execution.id, 'FAILED', result.error);
          this.logger.error(`Step ${stepIndex} failed: ${result.error}`);
          return execution.id;
        }

        // Merge step output into variables
        if (result.output) {
          variables = { ...variables, ...result.output };
        }

        // Handle branching
        if (result.nextStepId) {
          const branchIdx = sortedSteps.findIndex((s) => s.id === result.nextStepId);
          if (branchIdx >= 0) {
            stepIndex = branchIdx;
          } else {
            stepIndex++;
          }
        } else {
          stepIndex++;
        }
      }

      await this.executionRepo.updateStatus(execution.id, 'COMPLETED');
      this.logger.log(`Execution ${execution.id} completed successfully`);
      return execution.id;
    } catch (error: any) {
      await this.executionRepo.updateStatus(execution.id, 'FAILED', error.message);
      this.logger.error(`Execution ${execution.id} failed: ${error.message}`);
      return execution.id;
    }
  }

  private evaluateConditions(
    automation: AutomationEntity,
    payload: Record<string, unknown>,
  ): boolean {
    if (!automation.conditions || automation.conditions.length === 0) {
      return true;
    }

    return automation.conditions.every((condition) => {
      const field = condition['field'] as string;
      const operator = condition['operator'] as string;
      const expected = condition['value'];
      const actual = payload[field];

      switch (operator) {
        case 'equals':
          return actual === expected;
        case 'not_equals':
          return actual !== expected;
        case 'contains':
          return typeof actual === 'string' && actual.includes(String(expected));
        case 'gt':
          return Number(actual) > Number(expected);
        case 'lt':
          return Number(actual) < Number(expected);
        case 'exists':
          return actual !== undefined && actual !== null;
        default:
          return true;
      }
    });
  }
}
