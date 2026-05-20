export interface STTRequest {
  audioBuffer: Buffer;
  contentType: string;
  language?: string;
}

export interface STTResult {
  text: string;
  confidence: number;
  words?: { word: string; start: number; end: number }[];
}

export interface ISTTProvider {
  transcribe(request: STTRequest): Promise<STTResult>;
}

export const STT_PROVIDER = Symbol('ISTTProvider');
