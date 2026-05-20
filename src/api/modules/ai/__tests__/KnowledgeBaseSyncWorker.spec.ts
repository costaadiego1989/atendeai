import { KnowledgeBaseSyncWorker } from '../infrastructure/adapters/knowledge-sources/KnowledgeBaseSyncWorker';
import { IngestKnowledgeSourceUseCase } from '../application/use-cases/knowledge-base/IngestKnowledgeSourceUseCase';

describe('KnowledgeBaseSyncWorker', () => {
  let worker: KnowledgeBaseSyncWorker;
  let prisma: any;
  let ingestUseCase: jest.Mocked<IngestKnowledgeSourceUseCase>;

  beforeEach(() => {
    prisma = {
      knowledgeSource: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    ingestUseCase = {
      execute: jest.fn(),
    } as any;

    worker = new KnowledgeBaseSyncWorker(prisma, ingestUseCase);
  });

  it('should sync all active sources', async () => {
    const sources = [
      { id: 'src-1', tenantId: 'tenant-1', type: 'webpage', sourceUrl: 'https://a.com', name: 'A', credentials: null },
      { id: 'src-2', tenantId: 'tenant-2', type: 'notion', sourceUrl: 'https://notion.so/x', name: 'B', credentials: { notionApiKey: 'key' } },
    ];
    prisma.knowledgeSource.findMany.mockResolvedValue(sources);
    ingestUseCase.execute.mockResolvedValue({ success: true, chunksCreated: 5, contentHash: 'hash' });

    await worker.syncAllSources();

    expect(ingestUseCase.execute).toHaveBeenCalledTimes(2);
    expect(ingestUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', sourceId: 'src-1', sourceType: 'webpage' }),
    );
    expect(ingestUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-2', sourceId: 'src-2', sourceType: 'notion' }),
    );
  }, 30000);

  it('should do nothing when no sources found', async () => {
    prisma.knowledgeSource.findMany.mockResolvedValue([]);

    await worker.syncAllSources();

    expect(ingestUseCase.execute).not.toHaveBeenCalled();
  });

  it('should skip when already running (guard flag)', async () => {
    const sources = [
      { id: 'src-1', tenantId: 'tenant-1', type: 'webpage', sourceUrl: 'https://a.com', name: 'A', credentials: null },
    ];
    prisma.knowledgeSource.findMany.mockResolvedValue(sources);

    // Make execute take some time
    let resolveFirst: Function;
    ingestUseCase.execute.mockImplementation(() => new Promise((r) => { resolveFirst = r; }));

    // Start first sync (will hang on execute)
    const firstSync = worker.syncAllSources();

    // Give it a tick to start
    await new Promise((r) => setImmediate(r));

    // Second sync should skip immediately
    await worker.syncAllSources();

    // Resolve the first sync
    resolveFirst!({ success: true, chunksCreated: 1, contentHash: 'h' });
    await firstSync;

    // Only one call to execute (second sync was skipped)
    expect(ingestUseCase.execute).toHaveBeenCalledTimes(1);
  }, 30000);

  it('should continue processing other sources when one fails', async () => {
    const sources = [
      { id: 'src-1', tenantId: 'tenant-1', type: 'webpage', sourceUrl: 'https://a.com', name: 'A', credentials: null },
      { id: 'src-2', tenantId: 'tenant-1', type: 'webpage', sourceUrl: 'https://b.com', name: 'B', credentials: null },
    ];
    prisma.knowledgeSource.findMany.mockResolvedValue(sources);
    ingestUseCase.execute
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ success: true, chunksCreated: 3, contentHash: 'h2' });

    await worker.syncAllSources();

    expect(ingestUseCase.execute).toHaveBeenCalledTimes(2);
  }, 30000);

  it('should reset isRunning flag after completion', async () => {
    prisma.knowledgeSource.findMany.mockResolvedValue([]);

    await worker.syncAllSources();

    // Should be able to run again (flag was reset)
    prisma.knowledgeSource.findMany.mockResolvedValue([]);
    await worker.syncAllSources();

    // Both calls should have queried the DB
    expect(prisma.knowledgeSource.findMany).toHaveBeenCalledTimes(2);
  });
});
