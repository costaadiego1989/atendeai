import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import {
  AudioTranscriptionProvider,
  DocumentTextExtractor,
  ImageOcrProvider,
  MediaUnderstandingInput,
  MediaUnderstandingOutput,
} from '../../application/ports/IMediaUnderstandingProviders';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';

type EndpointKey =
  | 'MEDIA_IMAGE_OCR_ENDPOINT'
  | 'MEDIA_AUDIO_TRANSCRIPTION_ENDPOINT'
  | 'MEDIA_DOCUMENT_TEXT_ENDPOINT';

@Injectable()
abstract class HttpMediaUnderstandingAdapter {
  protected readonly logger = new Logger(HttpMediaUnderstandingAdapter.name);

  protected constructor(
    protected readonly configService: ConfigService,
    private readonly endpointKey: EndpointKey,
    private readonly providerName: string,
    private readonly traceSpanSuffix: string,
  ) {}

  protected async requestExtraction(
    input: MediaUnderstandingInput,
  ): Promise<MediaUnderstandingOutput> {
    const tenantId = input.tenantId ?? '';

    return traceAsync(
      `ai.media.${this.traceSpanSuffix}`,
      {
        'tenant.id': tenantId,
        'ai.conversation_id': input.conversationId ?? '',
        'ai.media.provider': this.providerName,
        'media.endpoint.config_key': this.endpointKey,
      },
      async () => this.performRequest(input),
    );
  }

  private async performRequest(
    input: MediaUnderstandingInput,
  ): Promise<MediaUnderstandingOutput> {
    const endpoint = this.configService.get<string>(this.endpointKey);
    const tenantId = input.tenantId ?? '';

    if (!endpoint) {
      return {
        provider: this.providerName,
        extractedText: '',
        metadata: { reason: 'ENDPOINT_NOT_CONFIGURED' },
      };
    }

    const rawTimeout = Number(
      this.configService.get<string>('MEDIA_UNDERSTANDING_HTTP_TIMEOUT_MS'),
    );
    const timeoutMs =
      Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 90_000;

    const apiKey =
      this.configService.get<string>(`${this.endpointKey}_API_KEY`) ||
      this.configService.get<string>('MEDIA_UNDERSTANDING_API_KEY');

    try {
      const response = await axios.post(
        endpoint,
        {
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          url: input.url,
          mimeType: input.mimeType,
          text: input.text,
          language: input.language || 'pt-BR',
        },
        {
          headers: {
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            'Content-Type': 'application/json',
          },
          timeout: timeoutMs,
        },
      );

      return this.normalizeResponse(response.data);
    } catch (error: unknown) {
      const ax = error as AxiosError;
      this.logger.error(
        `[${this.providerName}] falha tenantId=${tenantId} endpoint=${endpoint} code=${ax.code ?? 'n/a'} status=${ax.response?.status ?? 'n/a'} detail=${ax.message}`,
      );
      throw error;
    }
  }

  private normalizeResponse(
    data: Record<string, unknown>,
  ): MediaUnderstandingOutput {
    return {
      provider: (data.provider as string) || this.providerName,
      extractedText:
        (data.extractedText as string) ||
        (data.transcript as string) ||
        (data.text as string) ||
        (data.content as string) ||
        '',
      confidence: data.confidence as number | undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
    };
  }
}

@Injectable()
export class HttpImageOcrAdapter
  extends HttpMediaUnderstandingAdapter
  implements ImageOcrProvider
{
  constructor(configService: ConfigService) {
    super(
      configService,
      'MEDIA_IMAGE_OCR_ENDPOINT',
      'http-image-ocr',
      'ocr_image',
    );
  }

  extractTextFromImage(
    input: MediaUnderstandingInput,
  ): Promise<MediaUnderstandingOutput> {
    return this.requestExtraction(input);
  }
}

@Injectable()
export class HttpAudioTranscriptionAdapter
  extends HttpMediaUnderstandingAdapter
  implements AudioTranscriptionProvider
{
  constructor(configService: ConfigService) {
    super(
      configService,
      'MEDIA_AUDIO_TRANSCRIPTION_ENDPOINT',
      'http-audio-transcription',
      'audio_transcription',
    );
  }

  transcribe(
    input: MediaUnderstandingInput,
  ): Promise<MediaUnderstandingOutput> {
    return this.requestExtraction(input);
  }
}

@Injectable()
export class HttpDocumentTextExtractorAdapter
  extends HttpMediaUnderstandingAdapter
  implements DocumentTextExtractor
{
  constructor(configService: ConfigService) {
    super(
      configService,
      'MEDIA_DOCUMENT_TEXT_ENDPOINT',
      'http-document-text-extractor',
      'document_text',
    );
  }

  extractText(
    input: MediaUnderstandingInput,
  ): Promise<MediaUnderstandingOutput> {
    return this.requestExtraction(input);
  }
}
