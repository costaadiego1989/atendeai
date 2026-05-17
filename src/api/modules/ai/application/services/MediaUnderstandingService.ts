import {
  AudioTranscriptionProvider,
  DocumentTextExtractor,
  ImageOcrProvider,
  MediaUnderstandingInput,
  MediaUnderstandingOutput,
  MediaUnderstandingType,
} from '../ports/IMediaUnderstandingProviders';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';

export interface BuildMediaAiMessageInput extends MediaUnderstandingInput {
  type: MediaUnderstandingType;
}

export class MediaUnderstandingService {
  constructor(
    private readonly imageOcrProvider?: ImageOcrProvider,
    private readonly audioTranscriptionProvider?: AudioTranscriptionProvider,
    private readonly documentTextExtractor?: DocumentTextExtractor,
  ) {}

  async buildAiMessage(input: BuildMediaAiMessageInput): Promise<string> {
    return traceAsync(
      'ai.MediaUnderstandingService.buildAiMessage',
      {
        'tenant.id': input.tenantId ?? '',
        'ai.conversation_id': input.conversationId ?? '',
        'ai.media.kind': input.type,
      },
      async () => {
        const extraction = await this.extract(input);
        const label = this.getMediaLabel(input.type);
        const parts = [`Cliente enviou ${label} pelo WhatsApp.`];

        if (input.text?.trim()) {
          parts.push(`Mensagem: ${input.text.trim()}`);
        }

        if (extraction?.extractedText?.trim()) {
          const prefix =
            input.type === 'AUDIO' || input.type === 'VIDEO'
              ? 'Transcricao'
              : 'Conteudo extraido';
          parts.push(`${prefix}: ${extraction.extractedText.trim()}`);
        } else {
          parts.push(
            'Nao foi possível extrair o conteudo da midia automaticamente.',
          );
        }

        parts.push(`Arquivo: ${input.url}`);

        if (extraction?.provider) {
          parts.push(`Provedor de extracao: ${extraction.provider}`);
        }

        return parts.join('\n');
      },
    );
  }

  private async extract(
    input: BuildMediaAiMessageInput,
  ): Promise<MediaUnderstandingOutput | null> {
    const providerInput: MediaUnderstandingInput = {
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      url: input.url,
      mimeType: input.mimeType,
      text: input.text,
      language: input.language,
    };

    try {
      if (input.type === 'IMAGE') {
        return this.imageOcrProvider
          ? await this.imageOcrProvider.extractTextFromImage(providerInput)
          : null;
      }

      if (input.type === 'AUDIO' || input.type === 'VIDEO') {
        return this.audioTranscriptionProvider
          ? await this.audioTranscriptionProvider.transcribe(providerInput)
          : null;
      }

      if (input.type === 'DOCUMENT') {
        return this.documentTextExtractor
          ? await this.documentTextExtractor.extractText(providerInput)
          : null;
      }

      return null;
    } catch {
      return null;
    }
  }

  private getMediaLabel(type: MediaUnderstandingType): string {
    const labels: Record<MediaUnderstandingType, string> = {
      IMAGE: 'imagem',
      AUDIO: 'audio',
      VIDEO: 'video',
      DOCUMENT: 'documento',
    };

    return labels[type] ?? 'arquivo';
  }
}
