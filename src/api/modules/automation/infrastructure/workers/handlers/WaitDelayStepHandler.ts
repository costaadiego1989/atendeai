import { Injectable } from '@nestjs/common';
import { IStepHandler } from '../../../application/ports/IStepHandler';
import {
  StepExecutionContext,
  StepExecutionResult,
} from '../../../application/ports/IStepExecutor';
import { StepType } from '../../../domain/value-objects/StepType';

@Injectable()
export class WaitDelayStepHandler implements IStepHandler {
  readonly type = StepType.WAIT_DELAY;

  async execute(
    config: Record<string, unknown>,
    _context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const delayMs = Number(config['delayMs']) || 0;

    // Max 5 min inline wait; longer delays should use scheduled jobs.
    if (delayMs > 0 && delayMs <= 300_000) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return { success: true, output: { waited: delayMs } };
  }
}
