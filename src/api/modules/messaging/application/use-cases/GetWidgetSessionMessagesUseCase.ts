import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IWidgetConfigRepository,
  WIDGET_CONFIG_REPOSITORY,
} from '@modules/messaging/domain/repositories/IWidgetConfigRepository';
import {
  IWidgetSessionRepository,
  WIDGET_SESSION_REPOSITORY,
} from '@modules/messaging/domain/repositories/IWidgetSessionRepository';
import {
  IConversationRepository,
  CONVERSATION_REPOSITORY,
} from '@modules/messaging/domain/repositories/IConversationRepository';

export interface WidgetMessageDTO {
  id: string;
  direction: string;
  contentType: string;
  content: unknown;
  sentBy: string;
  createdAt: Date;
}

export interface GetWidgetSessionMessagesInput {
  publicToken: string;
  sessionId: string;
}

export interface GetWidgetSessionMessagesOutput {
  messages: WidgetMessageDTO[];
}

@Injectable()
export class GetWidgetSessionMessagesUseCase {
  constructor(
    @Inject(WIDGET_CONFIG_REPOSITORY)
    private readonly configRepo: IWidgetConfigRepository,
    @Inject(WIDGET_SESSION_REPOSITORY)
    private readonly sessionRepo: IWidgetSessionRepository,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepo: IConversationRepository,
  ) {}

  async execute(
    input: GetWidgetSessionMessagesInput,
  ): Promise<GetWidgetSessionMessagesOutput> {
    const config = await this.configRepo.findByPublicToken(input.publicToken);
    if (!config || !config.enabled) {
      throw new NotFoundException('Widget not found or disabled');
    }

    const session = await this.sessionRepo.findById(input.sessionId, config.tenantId);
    if (!session || !session.conversationId) {
      return { messages: [] };
    }

    const { data: messages } = await this.conversationRepo.findMessagesByConversation(
      session.conversationId,
      1,
      100,
    );

    return {
      messages: messages
        .filter((m) => m.sentBy !== 'SYSTEM')
        .map((m) => ({
          id: m.id.toString(),
          direction: m.direction,
          contentType: m.contentType,
          content: { text: m.content.text },
          sentBy: m.sentBy,
          createdAt: m.createdAt,
        })),
    };
  }
}
