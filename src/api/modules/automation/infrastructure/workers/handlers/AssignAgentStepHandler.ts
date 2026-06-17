import { Inject, Injectable } from '@nestjs/common';
import {
  MESSAGING_FACADE,
  IMessagingFacade,
} from '@modules/messaging/application/facades/MessagingFacade';
import { IStepHandler } from '../../../application/ports/IStepHandler';
import {
  StepExecutionContext,
  StepExecutionResult,
} from '../../../application/ports/IStepExecutor';
import { StepType } from '../../../domain/value-objects/StepType';

@Injectable()
export class AssignAgentStepHandler implements IStepHandler {
  readonly type = StepType.ASSIGN_AGENT;

  constructor(
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
  ) {}

  async execute(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    if (!context.contactId) {
      return { success: false, error: 'assign_agent requires a contactId' };
    }

    const agentId = (config['agentId'] as string)?.trim();
    if (!agentId) {
      return { success: false, error: 'assign_agent requires an agentId' };
    }

    const result = await this.messagingFacade.assignConversationUser({
      tenantId: context.tenantId,
      contactId: context.contactId,
      userId: agentId,
    });

    if (!result) {
      return {
        success: false,
        error: 'assign_agent: no conversation found for contact',
      };
    }

    return {
      success: true,
      output: {
        assigned: true,
        agentId,
        conversationId: result.conversationId,
      },
    };
  }
}
