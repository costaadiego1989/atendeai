import { NotionAdapter } from '../infrastructure/adapters/knowledge-sources/NotionAdapter';

describe('NotionAdapter', () => {
  let adapter: NotionAdapter;

  beforeEach(() => {
    adapter = new NotionAdapter();
    jest.restoreAllMocks();
  });

  describe('ingest', () => {
    it('should ingest a Notion page successfully', async () => {
      jest.spyOn(global, 'fetch')
        // Page metadata
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            properties: {
              title: { type: 'title', title: [{ plain_text: 'My Notion Page' }] },
            },
          }),
        } as any)
        // Page blocks
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            results: [
              {
                type: 'paragraph',
                paragraph: { rich_text: [{ plain_text: 'Hello from Notion.' }] },
              },
              {
                type: 'heading_2',
                heading_2: { rich_text: [{ plain_text: 'Section Title' }] },
              },
              {
                type: 'bulleted_list_item',
                bulleted_list_item: { rich_text: [{ plain_text: 'Item 1' }] },
              },
            ],
            has_more: false,
          }),
        } as any);

      const result = await adapter.ingest(
        'https://www.notion.so/workspace/My-Page-abcdef12345678901234567890abcdef?pvs=4',
        { notionApiKey: 'secret_test_key' },
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].title).toBe('My Notion Page');
      expect(result.contents[0].text).toContain('Hello from Notion');
      expect(result.contents[0].text).toContain('Section Title');
      expect(result.contents[0].text).toContain('• Item 1');
      expect(result.contentHash).toBeDefined();
    });

    it('should throw when API key is missing', async () => {
      await expect(
        adapter.ingest('https://notion.so/workspace/Page-abcdef12345678901234567890abcdef?pvs=4', {}),
      ).rejects.toThrow('Notion API key is required');
    });

    it('should throw when no credentials provided', async () => {
      await expect(
        adapter.ingest('https://notion.so/workspace/Page-abcdef12345678901234567890abcdef?pvs=4'),
      ).rejects.toThrow('Notion API key is required');
    });

    it('should throw on invalid Notion URL', async () => {
      await expect(
        adapter.ingest('https://www.notion.so/workspace/short?pvs=4', { notionApiKey: 'secret_key' }),
      ).rejects.toThrow('Invalid Notion URL');
    });

    it('should throw on page fetch failure', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      await expect(
        adapter.ingest(
          'https://notion.so/workspace/Page-abcdef12345678901234567890abcdef?pvs=4',
          { notionApiKey: 'secret_key' },
        ),
      ).rejects.toThrow('Failed to get Notion page: 404');
    });

    it('should handle paginated blocks', async () => {
      jest.spyOn(global, 'fetch')
        // Page metadata
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            properties: { Name: { type: 'title', title: [{ plain_text: 'Paginated' }] } },
          }),
        } as any)
        // First page of blocks
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            results: [
              { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Page 1 content' }] } },
            ],
            has_more: true,
            next_cursor: 'cursor-abc',
          }),
        } as any)
        // Second page of blocks
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            results: [
              { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Page 2 content' }] } },
            ],
            has_more: false,
          }),
        } as any);

      const result = await adapter.ingest(
        'https://notion.so/workspace/Test-abcdef12345678901234567890abcdef?pvs=4',
        { notionApiKey: 'secret_key' },
      );

      expect(result.contents[0].text).toContain('Page 1 content');
      expect(result.contents[0].text).toContain('Page 2 content');
    });

    it('should handle different block types', async () => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            properties: { title: { type: 'title', title: [{ plain_text: 'Mixed' }] } },
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            results: [
              { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Task 1' }], checked: true } },
              { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Task 2' }], checked: false } },
              { type: 'divider', divider: {} },
              { type: 'code', code: { rich_text: [{ plain_text: 'console.log("hi")' }] } },
            ],
            has_more: false,
          }),
        } as any);

      const result = await adapter.ingest(
        'https://notion.so/workspace/Page-abcdef12345678901234567890abcdef?pvs=4',
        { notionApiKey: 'secret_key' },
      );

      const text = result.contents[0].text;
      expect(text).toContain('✓ Task 1');
      expect(text).toContain('○ Task 2');
      expect(text).toContain('---');
      expect(text).toContain('console.log("hi")');
    });
  });
});
