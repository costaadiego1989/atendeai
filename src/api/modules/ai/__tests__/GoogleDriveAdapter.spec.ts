import { GoogleDriveAdapter } from '../infrastructure/adapters/knowledge-sources/GoogleDriveAdapter';

describe('GoogleDriveAdapter', () => {
  let adapter: GoogleDriveAdapter;

  beforeEach(() => {
    adapter = new GoogleDriveAdapter();
    jest.restoreAllMocks();
  });

  describe('ingest', () => {
    it('should ingest a Google Doc (exported as text)', async () => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            name: 'My Document',
            mimeType: 'application/vnd.google-apps.document',
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue('This is the document content exported as plain text.'),
        } as any);

      const result = await adapter.ingest(
        'https://docs.google.com/document/d/abc123def/edit',
        { accessToken: 'token-123' },
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].title).toBe('My Document');
      expect(result.contents[0].text).toContain('document content');
      expect(result.contentHash).toBeDefined();
    });

    it('should ingest a Google Spreadsheet (exported as CSV)', async () => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            name: 'Sales Data',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue('Name,Amount\nJoão,500\nMaria,300'),
        } as any);

      const result = await adapter.ingest(
        'https://docs.google.com/spreadsheets/d/xyz789/edit',
        { accessToken: 'token-123' },
      );

      expect(result.contents[0].title).toBe('Sales Data');
      expect(result.contents[0].text).toContain('João,500');
    });

    it('should ingest a raw file (non-Google format)', async () => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            name: 'notes.txt',
            mimeType: 'text/plain',
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue('Plain text file content.'),
        } as any);

      const result = await adapter.ingest(
        'https://drive.google.com/file/d/file123/view',
        { accessToken: 'token-123' },
      );

      expect(result.contents[0].title).toBe('notes.txt');
      expect(result.contents[0].text).toBe('Plain text file content.');
    });

    it('should throw when access token is missing', async () => {
      await expect(
        adapter.ingest('https://drive.google.com/file/d/abc/view', {}),
      ).rejects.toThrow('Google Drive access token is required');
    });

    it('should throw when no credentials provided', async () => {
      await expect(
        adapter.ingest('https://drive.google.com/file/d/abc/view'),
      ).rejects.toThrow('Google Drive access token is required');
    });

    it('should throw on metadata fetch failure', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
      } as any);

      await expect(
        adapter.ingest(
          'https://drive.google.com/file/d/abc/view',
          { accessToken: 'expired-token' },
        ),
      ).rejects.toThrow('Failed to get file metadata: 403');
    });

    it('should throw on invalid Google Drive URL', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ name: 'x', mimeType: 'text/plain' }),
      } as any);

      await expect(
        adapter.ingest('https://not-google.com/random', { accessToken: 'token' }),
      ).rejects.toThrow('Invalid Google Drive URL');
    });
  });
});
