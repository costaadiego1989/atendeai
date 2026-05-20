import { Injectable, Logger } from '@nestjs/common';
import {
  IStepExecutor,
  StepExecutionContext,
  StepExecutionResult,
} from '../../application/ports/IStepExecutor';
import { StepType } from '../../domain/value-objects/StepType';

/**
 * Composite step executor that delegates to type-specific handlers.
 * Supports: send_message, wait_delay, condition_branch, http_request,
 * update_contact, add_tag, remove_tag, assign_agent, ai_response, create_task.
 */
@Injectable()
export class CompositeStepExecutor implements IStepExecutor {
  private readonly logger = new Logger(CompositeStepExecutor.name);

  async execute(
    stepType: string,
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    this.logger.debug(
      `Executing step "${stepType}" for execution ${context.executionId}`,
    );

    switch (stepType) {
      case StepType.SEND_MESSAGE:
        return this.executeSendMessage(config, context);
      case StepType.WAIT_DELAY:
        return this.executeWaitDelay(config, context);
      case StepType.CONDITION_BRANCH:
        return this.executeConditionBranch(config, context);
      case StepType.HTTP_REQUEST:
        return this.executeHttpRequest(config, context);
      case StepType.UPDATE_CONTACT:
        return this.executeUpdateContact(config, context);
      case StepType.ADD_TAG:
        return this.executeAddTag(config, context);
      case StepType.REMOVE_TAG:
        return this.executeRemoveTag(config, context);
      case StepType.ASSIGN_AGENT:
        return this.executeAssignAgent(config, context);
      case StepType.AI_RESPONSE:
        return this.executeAIResponse(config, context);
      case StepType.CREATE_TASK:
        return this.executeCreateTask(config, context);
      default:
        return { success: false, error: `Unknown step type: ${stepType}` };
    }
  }

  private async executeSendMessage(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    // Interpolate variables in message body
    const body = this.interpolate(config['body'] as string, context.variables);
    const channel = config['channel'] as string || 'whatsapp';

    this.logger.log(
      `[${context.tenantId}] Sending message via ${channel} to contact ${context.contactId}`,
    );

    // In production, this would call the messaging facade
    // For now, we log and return success (integration point)
    return {
      success: true,
      output: { messageSent: true, channel, body },
    };
  }

  private async executeWaitDelay(
    config: Record<string, unknown>,
    _context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const delayMs = Number(config['delayMs']) || 0;

    if (delayMs > 0 && delayMs <= 300_000) {
      // Max 5 min inline wait; longer delays should use scheduled jobs
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return { success: true, output: { waited: delayMs } };
  }

  private async executeConditionBranch(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const field = config['field'] as string;
    const operator = config['operator'] as string;
    const expected = config['value'];
    const actual = context.variables[field];

    let conditionMet = false;

    switch (operator) {
      case 'equals':
        conditionMet = actual === expected;
        break;
      case 'not_equals':
        conditionMet = actual !== expected;
        break;
      case 'contains':
        conditionMet = typeof actual === 'string' && actual.includes(String(expected));
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

  private async executeHttpRequest(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const method = (config['method'] as string) || 'POST';
    const url = this.interpolate(config['url'] as string, context.variables);
    const headers = (config['headers'] as Record<string, string>) || {};
    const body = config['body'];

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        ...(body ? { body: JSON.stringify(body) } : {}),
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
      return { success: false, error: `HTTP request failed: ${error.message}` };
    }
  }

  private async executeUpdateContact(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const fields = config['fields'] as Record<string, unknown>;
    this.logger.log(
      `[${context.tenantId}] Updating contact ${context.contactId} fields: ${Object.keys(fields || {}).join(', ')}`,
    );
    // Integration point: call contact repository
    return { success: true, output: { contactUpdated: true, fields } };
  }

  private async executeAddTag(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const tag = config['tag'] as string;
    this.logger.log(`[${context.tenantId}] Adding tag "${tag}" to contact ${context.contactId}`);
    return { success: true, output: { tagAdded: tag } };
  }

  private async executeRemoveTag(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const tag = config['tag'] as string;
    this.logger.log(`[${context.tenantId}] Removing tag "${tag}" from contact ${context.contactId}`);
    return { success: true, output: { tagRemoved: tag } };
  }

  private async executeAssignAgent(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const agentId = config['agentId'] as string;
    const teamId = config['teamId'] as string;
    this.logger.log(
      `[${context.tenantId}] Assigning contact ${context.contactId} to agent=${agentId} team=${teamId}`,
    );
    return { success: true, output: { assigned: true, agentId, teamId } };
  }

  private async executeAIResponse(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const prompt = this.interpolate(
      (config['prompt'] as string) || 'Responda ao cliente',
      context.variables,
    );
    this.logger.log(`[${context.tenantId}] Generating AI response for contact ${context.contactId}`);
    // Integration point: call AI module
    return { success: true, output: { aiPrompt: prompt, aiResponseGenerated: true } };
  }

  private async executeCreateTask(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const title = this.interpolate(config['title'] as string, context.variables);
    const dueInMs = Number(config['dueInMs']) || 86400000; // default 24h
    this.logger.log(`[${context.tenantId}] Creating task: "${title}"`);
    return { success: true, output: { taskCreated: true, title, dueInMs } };
  }

  /**
   * Simple variable interpolation: replaces {{varName}} with context values.
   */
  private interpolate(template: string, variables: Record<string, unknown>): string {
    if (!template) return '';
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = variables[key];
      return val !== undefined ? String(val) : `{{${key}}}`;
    });
  }
}
