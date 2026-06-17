import { Inject, Injectable } from '@nestjs/common';
import {
  AUTOMATION_AI_REPLY_FACADE,
  IAutomationAiReplyFacade,
} from '@modules/ai/application/facades/AutomationAiReplyFacade';
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
export class AiResponseStepHandler implements IStepHandler {
  readonly type = StepType.AI_RESPONSE;

  constructor(
    @Inject(AUTOMATION_AI_REPLY_FACADE)
    private readonly aiReplyFacade: IAutomationAiReplyFacade,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
  ) {}

  async execute(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    if (!context.contactId) {
      return { success: false, error: 'ai_response requires a contactId' };
    }

    const prompt = interpolate(
      (config['prompt'] as string) || 'Responda ao cliente de forma cordial.',
      context.variables,
    );

    const lastMessage =
      typeof context.variables['message'] === 'string'
        ? (context.variables['message'] as string)
        : '';

    const { text, denied, reason } = await this.aiReplyFacade.generateReply({
      tenantId: context.tenantId,
      prompt,
      userMessage: lastMessage,
    });

    if (denied) {
      return {
        success: false,
        error: `ai_response: AI generation denied (${reason ?? 'quota'})`,
      };
    }

    if (!text) {
      return { success: false, error: 'ai_response: empty AI reply' };
    }

    const channel = CHANNEL_MAP[(config['channel'] as string) || 'whatsapp'];
    if (!channel) {
      // Generation succeeded but channel unsupported — surface the text.
      return { success: true, output: { aiText: text, messageSent: false } };
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
        aiText: text,
        messageSent: true,
        conversationId: result.conversationId,
        messageId: result.messageId,
      },
    };
  }
}
