import { WebCrawlerAdapter } from '../infrastructure/adapters/knowledge-sources/WebCrawlerAdapter';

describe('WebCrawlerAdapter', () => {
  let adapter: WebCrawlerAdapter;

  beforeEach(() => {
    adapter = new WebCrawlerAdapter();
    jest.restoreAllMocks();
  });

  describe('ingest', () => {
    it('should fetch and extract text from a webpage', async () => {
      const html = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Welcome</h1>
            <p>This is a paragraph with enough content to pass the 50 character minimum threshold for sections.</p>
            <p>Another paragraph with sufficient content to be included in the extracted sections of the page.</p>
          </body>
        </html>
      `;
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(html),
      } as any);

      const result = await adapter.ingest('https://example.com/page');

      expect(result.contentHash).toBeDefined();
      expect(result.contentHash.length).toBe(64); // SHA-256 hex
      expect(result.contents.length).toBeGreaterThanOrEqual(1);
      expect(result.contents[0].title).toBe('Test Page');
      expect(result.contents[0].sourceUrl).toBe('https://example.com/page');
    });

    it('should throw on HTTP error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      await expect(
        adapter.ingest('https://example.com/not-found'),
      ).rejects.toThrow('Failed to fetch');
    });

    it('should remove script and style tags from extracted text', async () => {
      const html = `
        <html>
          <head><title>Page</title></head>
          <body>
            <script>alert('xss')</script>
            <style>.hidden { display: none; }</style>
            <p>This is the actual visible content that should be extracted from the page without scripts or styles.</p>
          </body>
        </html>
      `;
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(html),
      } as any);

      const result = await adapter.ingest('https://example.com');

      const allText = result.contents.map((c) => c.text).join(' ');
      expect(allText).not.toContain('alert');
      expect(allText).not.toContain('display: none');
      expect(allText).toContain('actual visible content');
    });

    it('should use full text when no sections are detected', async () => {
      const html = `
        <html>
          <head><title>Simple</title></head>
          <body>
            <p>This is a simple page with a single long paragraph that has more than fifty characters of content for extraction.</p>
          </body>
        </html>
      `;
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(html),
      } as any);

      const result = await adapter.ingest('https://example.com/simple');

      expect(result.contents.length).toBeGreaterThanOrEqual(1);
    });

    it('should send correct User-Agent header', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><body><p>Content that is long enough to pass the minimum threshold for extraction.</p></body></html>'),
      } as any);

      await adapter.ingest('https://example.com');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('AtendeAI-Bot'),
          }),
        }),
      );
    });
  });
});
