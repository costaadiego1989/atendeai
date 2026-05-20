import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ITTSProvider, TTSRequest, TTSResult } from '../../application/ports/ITTSProvider';

/**
 * ElevenLabs adapter for text-to-speech synthesis.
 * Requires ELEVENLABS_API_KEY env var.
 */
@Injectable()
export class ElevenLabsTTSAdapter implements ITTSProvider {
  private readonly logger = new Logger(ElevenLabsTTSAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ELEVENLABS_API_KEY') || '';
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const response = await fetch(
      `${this.baseUrl}/text-to-speech/${request.voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: request.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`ElevenLabs TTS failed: ${error}`);
      throw new Error(`TTS synthesis failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Estimate duration: ~128kbps MP3
    const durationMs = Math.round((audioBuffer.length * 8) / 128);

    return {
      audioBuffer,
      contentType: 'audio/mpeg',
      durationMs,
    };
  }

  async listVoices(language?: string): Promise<{ id: string; name: string; language: string }[]> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: { 'xi-api-key': this.apiKey },
      });

      if (!response.ok) return [];

      const data = await response.json();
      const voices = (data.voices || []).map((v: any) => ({
        id: v.voice_id,
        name: v.name,
        language: v.labels?.language || 'pt-BR',
      }));

      if (language) {
        return voices.filter((v: any) => v.language.includes(language));
      }
      return voices;
    } catch {
      return [];
    }
  }
}
