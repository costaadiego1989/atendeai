import { Injectable, Logger, Optional } from '@nestjs/common';
import { MediaUnderstandingService } from './MediaUnderstandingService';
import { ProcessAIResponseInput } from '../use-cases/interfaces/IProcessAIResponseUseCase';

@Injectable()
export class AIUserMessageResolver {
  private readonly logger = new Logger(AIUserMessageResolver.name);

  constructor(
    @Optional()
    private readonly mediaUnderstandingService?: MediaUnderstandingService,
  ) {}

  async resolve(input: ProcessAIResponseInput): Promise<string> {
    const type = input.content.type?.toUpperCase();
    const isMedia = ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'].includes(
      type ?? '',
    );

    if (!isMedia || !input.content.url || !this.mediaUnderstandingService) {
      return this.toUserMessage(input.content);
    }

    return this.mediaUnderstandingService.buildAiMessage({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      type: type as 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT',
      url: input.content.url,
      text: input.content.text,
      mimeType: input.content.mimeType,
    });
  }

  private toUserMessage(content: ProcessAIResponseInput['content']): string {
    const text = content.text?.trim();
    const type = content.type?.toUpperCase();

    if (!type || type === 'TEXT') {
      return text || '';
    }

    const labels: Record<string, string> = {
      IMAGE: 'imagem',
      AUDIO: 'audio',
      VIDEO: 'video',
      DOCUMENT: 'documento',
    };
    const label = labels[type] || 'arquivo';
    const parts = [`Cliente enviou ${label} pelo WhatsApp.`];

    if (text) {
      parts.push(`Mensagem: ${text}`);
    }
    if (content.url) {
      parts.push(`Arquivo: ${content.url}`);
    }

    return parts.join('\n');
  }
}
