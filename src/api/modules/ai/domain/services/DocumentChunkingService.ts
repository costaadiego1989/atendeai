import { Injectable } from '@nestjs/common';

export interface ChunkResult {
  content: string;
  index: number;
  tokenCount: number;
}

export interface ChunkingOptions {
  chunkSize?: number;
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 2400; // ~600 tokens
const DEFAULT_OVERLAP = 400; // ~100 tokens
const SEPARATORS = ['\n\n', '\n', '. ', ' '];

/**
 * Recursive character text splitter for document chunking.
 * Splits text into semantically meaningful chunks with overlap
 * to preserve context across chunk boundaries.
 */
@Injectable()
export class DocumentChunkingService {
  chunk(text: string, options?: ChunkingOptions): ChunkResult[] {
    const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const overlap = options?.overlap ?? DEFAULT_OVERLAP;

    const cleanedText = text.replace(/\f/g, '\n\n').trim();
    if (!cleanedText) return [];

    const rawChunks = this.recursiveSplit(cleanedText, chunkSize, SEPARATORS);
    const overlappedChunks = this.applyOverlap(rawChunks, overlap, cleanedText);

    return overlappedChunks.map((content, index) => ({
      content,
      index,
      tokenCount: this.estimateTokens(content),
    }));
  }

  private recursiveSplit(
    text: string,
    chunkSize: number,
    separators: string[],
  ): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    const separator = this.findBestSeparator(text, separators);
    if (!separator) {
      // No separator found — hard split at chunkSize
      return this.hardSplit(text, chunkSize);
    }

    const parts = text.split(separator);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const part of parts) {
      const candidate = currentChunk ? currentChunk + separator + part : part;

      if (candidate.length <= chunkSize) {
        currentChunk = candidate;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        if (part.length > chunkSize) {
          // Recursively split with next separator level
          const remainingSeparators = separators.slice(
            separators.indexOf(separator) + 1,
          );
          const subChunks = this.recursiveSplit(
            part,
            chunkSize,
            remainingSeparators.length > 0 ? remainingSeparators : [],
          );
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = part;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private findBestSeparator(text: string, separators: string[]): string | null {
    for (const sep of separators) {
      if (text.includes(sep)) {
        return sep;
      }
    }
    return null;
  }

  private hardSplit(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private applyOverlap(
    chunks: string[],
    overlap: number,
    _originalText: string,
  ): string[] {
    if (chunks.length <= 1 || overlap <= 0) {
      return chunks;
    }

    const result: string[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const overlapText = prevChunk.slice(-overlap);
      result.push(overlapText + chunks[i]);
    }

    return result;
  }

  /** Rough token estimate: ~4 chars per token for English/Portuguese text */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
