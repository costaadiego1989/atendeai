import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import {
  HttpAudioTranscriptionAdapter,
  HttpDocumentTextExtractorAdapter,
  HttpImageOcrAdapter,
} from '../infrastructure/adapters/HttpMediaUnderstandingAdapters';

jest.mock('axios', () => ({
  post: jest.fn(),
}));

describe('HttpMediaUnderstandingAdapters', () => {
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          MEDIA_IMAGE_OCR_ENDPOINT: 'https://ocr.test/extract',
          MEDIA_AUDIO_TRANSCRIPTION_ENDPOINT: 'https://audio.test/transcribe',
          MEDIA_DOCUMENT_TEXT_ENDPOINT: 'https://doc.test/extract',
          MEDIA_UNDERSTANDING_API_KEY: 'secret-key',
        };

        return values[key];
      }),
    } as any;
  });

  it('should call the configured OCR endpoint and normalize the response', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        extractedText: 'texto da imagem',
        confidence: 0.9,
      },
    });

    const adapter = new HttpImageOcrAdapter(configService);
    const output = await adapter.extractTextFromImage({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      url: 'https://media.test/image.jpg',
      mimeType: 'image/jpeg',
      text: 'legenda',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://ocr.test/extract',
      {
        tenantId: 'tenant-1',
        conversationId: 'conversation-1',
        url: 'https://media.test/image.jpg',
        mimeType: 'image/jpeg',
        text: 'legenda',
        language: 'pt-BR',
      },
      {
        headers: {
          Authorization: 'Bearer secret-key',
          'Content-Type': 'application/json',
        },
      },
    );
    expect(output).toEqual({
      provider: 'http-image-ocr',
      extractedText: 'texto da imagem',
      confidence: 0.9,
      metadata: undefined,
    });
  });

  it('should call the configured audio transcription endpoint and normalize transcript fields', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        transcript: 'texto do audio',
      },
    });

    const adapter = new HttpAudioTranscriptionAdapter(configService);
    const output = await adapter.transcribe({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      url: 'https://media.test/audio.ogg',
      mimeType: 'audio/ogg',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://audio.test/transcribe',
      expect.objectContaining({
        url: 'https://media.test/audio.ogg',
        language: 'pt-BR',
      }),
      expect.any(Object),
    );
    expect(output.extractedText).toBe('texto do audio');
    expect(output.provider).toBe('http-audio-transcription');
  });

  it('should call the configured document extraction endpoint and normalize text fields', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        text: 'texto do documento',
        metadata: { pages: 2 },
      },
    });

    const adapter = new HttpDocumentTextExtractorAdapter(configService);
    const output = await adapter.extractText({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      url: 'https://media.test/document.pdf',
      mimeType: 'application/pdf',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://doc.test/extract',
      expect.objectContaining({
        url: 'https://media.test/document.pdf',
      }),
      expect.any(Object),
    );
    expect(output).toEqual({
      provider: 'http-document-text-extractor',
      extractedText: 'texto do documento',
      confidence: undefined,
      metadata: { pages: 2 },
    });
  });

  it('should return an empty extraction when the endpoint is not configured', async () => {
    configService.get.mockReturnValue(undefined);

    const adapter = new HttpImageOcrAdapter(configService);
    const output = await adapter.extractTextFromImage({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      url: 'https://media.test/image.jpg',
    });

    expect(axios.post).not.toHaveBeenCalled();
    expect(output).toEqual({
      provider: 'http-image-ocr',
      extractedText: '',
      metadata: { reason: 'ENDPOINT_NOT_CONFIGURED' },
    });
  });
});
