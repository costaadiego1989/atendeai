import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ISTTProvider,
  STTRequest,
  STTResult,
} from '../../application/ports/ISTTProvider';

/**
 * Deepgram adapter for speech-to-text transcription.
 * Requires DEEPGRAM_API_KEY env var.
 */
@Injectable()
export class DeepgramSTTAdapter implements ISTTProvider {
  private readonly logger = new Logger(DeepgramSTTAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.deepgram.com/v1/listen';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DEEPGRAM_API_KEY') || '';
  }

  async transcribe(request: STTRequest): Promise<STTResult> {
    const params = new URLSearchParams({
      model: 'nova-2',
      language: request.language || 'pt-BR',
      punctuate: 'true',
      smart_format: 'true',
    });

    const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.apiKey}`,
        'Content-Type': request.contentType || 'audio/webm',
      },
      body: request.audioBuffer as unknown as BodyInit,
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Deepgram STT failed: ${error}`);
      throw new Error(`STT transcription failed: ${response.status}`);
    }

    const data = await response.json();
    const alternative = data.results?.channels?.[0]?.alternatives?.[0];

    if (!alternative) {
      return { text: '', confidence: 0 };
    }

    return {
      text: alternative.transcript || '',
      confidence: alternative.confidence || 0,
      words: alternative.words?.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      })),
    };
  }
}
