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
import { interpolate } from './interpolate';

const CHANNEL_MAP: Record<string, 'WHATSAPP' | 'INSTAGRAM'> = {
  whatsapp: 'WHATSAPP',
  instagram: 'INSTAGRAM',
};

@Injectable()
export class SendMessageStepHandler implements IStepHandler {
  readonly type = StepType.SEND_MESSAGE;

  constructor(
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
  ) {}

  async execute(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    if (!context.contactId) {
      return { success: false, error: 'send_message requires a contactId' };
    }

    const channel = CHANNEL_MAP[(config['channel'] as string) || 'whatsapp'];
    if (!channel) {
      return {
        success: false,
        error: `Unsupported channel for automation: ${String(config['channel'])}`,
      };
    }

    const text = interpolate(config['body'] as string, context.variables);
    if (!text) {
      return { success: false, error: 'send_message requires a body' };
    }

    const result = await this.messagingFacade.queueSystemMessage({
      tenantId: context.tenantId,
      contactId: context.contactId,
      channel,
      text,
    });

    return {
      success: true,
      output: {
        messageSent: true,
        channel,
        conversationId: result.conversationId,
        messageId: result.messageId,
      },
    };
  }
}
