import { DocumentChunkingService } from '../domain/services/DocumentChunkingService';

describe('DocumentChunkingService', () => {
  let service: DocumentChunkingService;

  beforeEach(() => {
    service = new DocumentChunkingService();
  });

  it('should return empty array for empty text', () => {
    expect(service.chunk('')).toEqual([]);
    expect(service.chunk('   ')).toEqual([]);
  });

  it('should return single chunk for short text', () => {
    const text = 'Hello world. This is a short text.';
    const result = service.chunk(text);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe(text);
    expect(result[0].index).toBe(0);
    expect(result[0].tokenCount).toBeGreaterThan(0);
  });

  it('should estimate tokens as ceil(length / 4)', () => {
    const text = 'A'.repeat(100);
    const result = service.chunk(text);

    expect(result[0].tokenCount).toBe(25);
  });

  it('should split long text into multiple chunks', () => {
    // Create text longer than default chunkSize (2400 chars)
    const paragraph = 'Lorem ipsum dolor sit amet. ';
    const text = paragraph.repeat(200); // ~5600 chars

    const result = service.chunk(text);

    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.tokenCount).toBeGreaterThan(0);
    });
  });

  it('should split on paragraph boundaries (\\n\\n) first', () => {
    const para1 = 'A'.repeat(1000);
    const para2 = 'B'.repeat(1000);
    const para3 = 'C'.repeat(1000);
    const text = `${para1}\n\n${para2}\n\n${para3}`;

    const result = service.chunk(text, { chunkSize: 2500, overlap: 0 });

    // Should split at paragraph boundaries
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].content).toContain('A');
  });

  it('should apply overlap between chunks', () => {
    const para1 = 'A'.repeat(1500);
    const para2 = 'B'.repeat(1500);
    const text = `${para1}\n\n${para2}`;

    const result = service.chunk(text, { chunkSize: 1600, overlap: 200 });

    expect(result.length).toBe(2);
    // Second chunk should start with overlap from first chunk
    expect(result[1].content.startsWith('A')).toBe(true);
  });

  it('should handle form-feed characters as paragraph separators', () => {
    const page1 = 'Page one content here.';
    const page2 = 'Page two content here.';
    const text = `${page1}\f${page2}`;

    const result = service.chunk(text);

    // Form feeds are converted to \n\n
    expect(result[0].content).toContain('Page one content here.');
    expect(result[0].content).toContain('Page two content here.');
  });

  it('should respect custom chunkSize and overlap', () => {
    const text = 'Word '.repeat(500); // 2500 chars

    const result = service.chunk(text, { chunkSize: 500, overlap: 50 });

    expect(result.length).toBeGreaterThan(4);
    result.forEach((chunk) => {
      // First chunk should be <= chunkSize, subsequent may be slightly larger due to overlap
      expect(chunk.content.length).toBeLessThanOrEqual(600); // chunkSize + overlap
    });
  });

  it('should handle text with only spaces as separators', () => {
    // Long text with no newlines or periods
    const text = 'word '.repeat(600); // 3000 chars, only space separators

    const result = service.chunk(text, { chunkSize: 1000, overlap: 0 });

    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(1000);
    });
  });

  it('should hard-split text with no separators', () => {
    const text = 'A'.repeat(5000); // No separators at all

    const result = service.chunk(text, { chunkSize: 1000, overlap: 0 });

    expect(result.length).toBe(5);
    expect(result[0].content).toBe('A'.repeat(1000));
  });

  it('should assign sequential indices', () => {
    const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
    const result = service.chunk(text);

    result.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });
});
