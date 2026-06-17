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

    // Inline wait caps at 5 min. Don't silently "succeed" on longer delays —
    // that would fire downstream steps immediately. Surface it so the flow
    // can be reconfigured to use a scheduled delay.
    if (delayMs > 300_000) {
      return {
        success: false,
        error: `wait_delay ${delayMs}ms exceeds inline max (300000ms); use a scheduled delay`,
      };
    }

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return { success: true, output: { waited: delayMs } };
  }
}
