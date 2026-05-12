import { Injectable } from '@nestjs/common';
import { ConversationIntelligenceService } from '../ConversationIntelligenceService';
import { InboundMessageContext } from './InboundMessageContext';

@Injectable()
export class AnalyzeMessageStep {
  constructor(
    private readonly conversationIntelligenceService: ConversationIntelligenceService,
  ) {}

  async execute(ctx: InboundMessageContext): Promise<InboundMessageContext> {
    await this.conversationIntelligenceService.captureMessageSignal({
      tenantId: ctx.input.tenantId,
      conversationId: ctx.conversation!.id.toString(),
      direction: 'INBOUND',
      sentBy: 'CONTACT',
      text: ctx.signalText!,
      options: { tx: ctx.tx },
    });

    return { ...ctx, intelligenceCaptured: true };
  }
}
