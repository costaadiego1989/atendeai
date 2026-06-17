import { Injectable } from '@nestjs/common';
import { IStepHandler } from '../../../application/ports/IStepHandler';
import {
  StepExecutionContext,
  StepExecutionResult,
} from '../../../application/ports/IStepExecutor';
import { StepType } from '../../../domain/value-objects/StepType';

@Injectable()
export class ConditionBranchStepHandler implements IStepHandler {
  readonly type = StepType.CONDITION_BRANCH;

  async execute(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const field = config['field'] as string;
    const operator = config['operator'] as string;
    const expected = config['value'];
    const actual = context.variables[field];

    let conditionMet = false;

    // Config values arrive as JSON (often strings) while runtime variables may
    // be numbers/booleans; compare by normalized string so "1" matches 1.
    const eq = (a: unknown, b: unknown): boolean =>
      a === b || (a != null && b != null && String(a) === String(b));

    switch (operator) {
      case 'equals':
        conditionMet = eq(actual, expected);
        break;
      case 'not_equals':
        conditionMet = !eq(actual, expected);
        break;
      case 'contains':
        conditionMet =
          typeof actual === 'string' && actual.includes(String(expected));
        break;
      case 'gt':
        conditionMet = Number(actual) > Number(expected);
        break;
      case 'lt':
        conditionMet = Number(actual) < Number(expected);
        break;
      case 'exists':
        conditionMet = actual !== undefined && actual !== null;
        break;
      default:
        conditionMet = true;
    }

    const nextStepId = conditionMet
      ? (config['trueStepId'] as string)
      : (config['falseStepId'] as string);

    return {
      success: true,
      output: { conditionMet },
      nextStepId: nextStepId || null,
    };
  }
}
