export interface TTSRequest {
  text: string;
  voiceId: string;
  language?: string;
}

export interface TTSResult {
  audioBuffer: Buffer;
  contentType: string;
  durationMs: number;
}

export interface ITTSProvider {
  synthesize(request: TTSRequest): Promise<TTSResult>;
  listVoices(language?: string): Promise<{ id: string; name: string; language: string }[]>;
}

export const TTS_PROVIDER = Symbol('ITTSProvider');
