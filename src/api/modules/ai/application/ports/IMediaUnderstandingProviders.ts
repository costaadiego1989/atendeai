export type MediaUnderstandingType = 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';

export interface MediaUnderstandingInput {
  tenantId: string;
  conversationId: string;
  type?: MediaUnderstandingType;
  url: string;
  mimeType?: string;
  text?: string;
  language?: string;
}

export interface MediaUnderstandingOutput {
  provider: string;
  extractedText: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface ImageOcrProvider {
  extractTextFromImage(input: MediaUnderstandingInput): Promise<MediaUnderstandingOutput>;
}

export interface AudioTranscriptionProvider {
  transcribe(input: MediaUnderstandingInput): Promise<MediaUnderstandingOutput>;
}

export interface DocumentTextExtractor {
  extractText(input: MediaUnderstandingInput): Promise<MediaUnderstandingOutput>;
}

export const IMAGE_OCR_PROVIDER = Symbol('IMAGE_OCR_PROVIDER');
export const AUDIO_TRANSCRIPTION_PROVIDER = Symbol('AUDIO_TRANSCRIPTION_PROVIDER');
export const DOCUMENT_TEXT_EXTRACTOR = Symbol('DOCUMENT_TEXT_EXTRACTOR');
