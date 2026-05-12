import { Inject, Injectable } from '@nestjs/common';
import {
  IConversationRepository,
  CONVERSATION_REPOSITORY,
} from '../../../domain/repositories/IConversationRepository';
import { Message } from '../../../domain/entities/Message';
import { MessageContent } from '../../../domain/value-objects/MessageContent';
import { ProcessInboundMessageInput } from '../../use-cases/interfaces/IProcessInboundMessageUseCase';
import { InboundMessageContext } from './InboundMessageContext';

@Injectable()
export class PersistMessageStep {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
  ) {}

  async execute(ctx: InboundMessageContext): Promise<InboundMessageContext> {
    const conversation = ctx.conversation!;
    const contentType = this.normalizeContentType(ctx.input.contentType);

    const content = MessageContent.create({
      type: contentType,
      ...(ctx.input.content.text ? { text: ctx.input.content.text } : {}),
      ...(ctx.input.content.url ? { url: ctx.input.content.url } : {}),
      ...(contentType !== 'TEXT'
        ? {
            metadata: {
              source: ctx.input.channel,
              originalType: ctx.input.contentType,
              ...(ctx.input.content.mimeType ? { mimeType: ctx.input.content.mimeType } : {}),
              ...(ctx.input.content.fileName ? { fileName: ctx.input.content.fileName } : {}),
            },
          }
        : {}),
    });

    const signalText = this.toSignalText(content.toPersistence());

    const message = Message.create({
      conversationId: conversation.id,
      direction: 'INBOUND',
      contentType,
      content,
      sentBy: 'CONTACT',
      externalId: ctx.input.externalMessageId,
    });

    conversation.addMessage(message);

    await this.conversationRepository.save(conversation, { tx: ctx.tx });

    if (ctx.shouldReleaseAssignment) {
      await this.conversationRepository.setAssignedUser(
        ctx.input.tenantId,
        conversation.id.toString(),
        null,
      );
    }

    return { ...ctx, message, signalText };
  }

  private normalizeContentType(contentType: ProcessInboundMessageInput['contentType']) {
    return contentType.toUpperCase() as 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';
  }

  private toSignalText(content: { type: string; text?: string; url?: string }) {
    if (content.type === 'TEXT') {
      return content.text || '';
    }

    const labels: Record<string, string> = {
      IMAGE: 'imagem',
      AUDIO: 'audio',
      VIDEO: 'video',
      DOCUMENT: 'documento',
    };
    const label = labels[content.type] || 'arquivo';
    const parts = [`Cliente enviou ${label} pelo WhatsApp.`];

    if (content.text) {
      parts.push(`Mensagem: ${content.text}`);
    }
    if (content.url) {
      parts.push(`Arquivo: ${content.url}`);
    }

    return parts.join('\n');
  }
}
