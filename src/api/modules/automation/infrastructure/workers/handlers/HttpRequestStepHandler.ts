import { Injectable } from '@nestjs/common';
import { IStepHandler } from '../../../application/ports/IStepHandler';
import {
  StepExecutionContext,
  StepExecutionResult,
} from '../../../application/ports/IStepExecutor';
import { StepType } from '../../../domain/value-objects/StepType';
import { interpolate } from './interpolate';

@Injectable()
export class HttpRequestStepHandler implements IStepHandler {
  readonly type = StepType.HTTP_REQUEST;

  async execute(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const method = (config['method'] as string) || 'POST';
    const url = interpolate(config['url'] as string, context.variables);
    const headers = (config['headers'] as Record<string, string>) || {};
    const body = config['body'];

    if (!url) {
      return { success: false, error: 'HTTP request requires a url' };
    }

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
      });

      const responseData = await response.text();

      return {
        success: response.ok,
        output: {
          httpStatus: response.status,
          httpResponse: responseData.substring(0, 1000),
        },
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `HTTP request failed: ${error.message}`,
      };
    }
  }
}
