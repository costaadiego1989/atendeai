import { InventoryAsyncJobProcessor } from '../infrastructure/queue/InventoryAsyncJobProcessor';
import { InventoryAsyncJobsService } from '../infrastructure/persistence/repositories/InventoryAsyncJobsService';
import {
  GenerateInventoryReportUseCase,
  GenerateInventoryReportOutput,
} from '../application/use-cases/GenerateInventoryReportUseCase';
import { InventoryReportCsvBuilder } from '../application/services/InventoryReportCsvBuilder';
import { SyncInventoryConnectionUseCase } from '../application/use-cases/SyncInventoryConnectionUseCase';
import { FileStorageService } from '@shared/domain/services/FileStorageService';
import { Job } from 'bullmq';
import { InventoryItemRecord } from '../domain/ports/IInventoryRepository';

describe('InventoryAsyncJobProcessor', () => {
  let processor: InventoryAsyncJobProcessor;
  let asyncJobsService: jest.Mocked<
    Pick<
      InventoryAsyncJobsService,
      'markProcessing' | 'completeJob' | 'failJob'
    >
  >;
  let generateReportUseCase: jest.Mocked<
    Pick<GenerateInventoryReportUseCase, 'execute'>
  >;
  let csvBuilder: jest.Mocked<Pick<InventoryReportCsvBuilder, 'build'>>;
  let fileStorage: jest.Mocked<FileStorageService>;
  let syncConnectionUseCase: jest.Mocked<
    Pick<SyncInventoryConnectionUseCase, 'execute'>
  >;

  const basePayload = {
    asyncJobId: 'job-001',
    type: 'EXPORT_INVENTORY_REPORT_CSV' as const,
    tenantId: 'tenant-001',
  };

  const stubItem: InventoryItemRecord = {
    id: 'item-1',
    tenantId: 'tenant-001',
    sku: 'SKU-001',
    name: 'Produto A',
    availableQuantity: 10,
    availabilityStatus: 'AVAILABLE',
    currency: 'BRL',
    source: 'BLING',
    lastSyncedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const baseReport: GenerateInventoryReportOutput = {
    generatedAt: new Date('2024-01-01'),
    summary: {
      totalItems: 1,
      totalQuantity: 10,
      availableItems: 1,
      lowStockItems: 0,
      unavailableItems: 0,
      reservedItems: 0,
      estimatedInventoryValue: 500,
    },
    items: [stubItem],
  };

  const baseCsv = {
    fileName: 'relatorio-estoque-2024-01-01.csv',
    mimeType: 'text/csv;charset=utf-8',
    content: 'Nome,SKU\nProduto A,SKU-001',
  };

  function makeJob(
    name: string,
    data: typeof basePayload,
  ): Job<typeof basePayload> {
    return { name, data } as unknown as Job<typeof basePayload>;
  }

  beforeEach(() => {
    asyncJobsService = {
      markProcessing: jest.fn().mockResolvedValue(undefined),
      completeJob: jest.fn().mockResolvedValue(undefined),
      failJob: jest.fn().mockResolvedValue(undefined),
    };

    generateReportUseCase = {
      execute: jest.fn().mockResolvedValue(baseReport),
    };

    csvBuilder = {
      build: jest.fn().mockReturnValue(baseCsv),
    };

    fileStorage = {
      upload: jest
        .fn()
        .mockResolvedValue('https://storage.example.com/report.csv'),
    } as unknown as jest.Mocked<FileStorageService>;

    syncConnectionUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    processor = new InventoryAsyncJobProcessor(
      asyncJobsService as unknown as InventoryAsyncJobsService,
      generateReportUseCase as unknown as GenerateInventoryReportUseCase,
      csvBuilder as unknown as InventoryReportCsvBuilder,
      fileStorage,
      syncConnectionUseCase as unknown as SyncInventoryConnectionUseCase,
    );
  });

  // ─── INV-T-095a: job name desconhecido ───────────────────────────────────

  it('INV-T-095a: ignora job com nome desconhecido sem processar', async () => {
    const job = makeJob('unknown-job-name', basePayload);

    await processor.process(job);

    expect(asyncJobsService.markProcessing).not.toHaveBeenCalled();
    expect(generateReportUseCase.execute).not.toHaveBeenCalled();
    expect(asyncJobsService.completeJob).not.toHaveBeenCalled();
  });

  // ─── INV-T-095b: happy path ──────────────────────────────────────────────

  it('INV-T-095b: happy path — marca processing, gera relatório, faz upload e completa o job', async () => {
    const job = makeJob('export-inventory-report-csv', basePayload);

    await processor.process(job);

    expect(asyncJobsService.markProcessing).toHaveBeenCalledWith('job-001', {
      progress: 30,
    });
    expect(generateReportUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-001' }),
    );
    expect(csvBuilder.build).toHaveBeenCalledWith(baseReport);
    expect(fileStorage.upload).toHaveBeenCalled();
    expect(asyncJobsService.completeJob).toHaveBeenCalledWith(
      'job-001',
      expect.objectContaining({
        fileUrl: 'https://storage.example.com/report.csv',
        processedItems: 1,
        totalItems: 1,
      }),
    );
    const completeArg = (asyncJobsService.completeJob as jest.Mock).mock
      .calls[0][1];
    expect(completeArg.fileContent).toBeUndefined();
    expect(asyncJobsService.failJob).not.toHaveBeenCalled();
  });

  // ─── INV-T-095c: fallback quando upload falha ────────────────────────────

  it('INV-T-095c: quando upload para storage falha, persiste fileContent no banco sem lançar erro', async () => {
    fileStorage.upload = jest
      .fn()
      .mockRejectedValue(new Error('S3 unavailable'));
    const job = makeJob('export-inventory-report-csv', basePayload);

    await processor.process(job);

    expect(asyncJobsService.failJob).not.toHaveBeenCalled();

    const callArg = (asyncJobsService.completeJob as jest.Mock).mock
      .calls[0][1];
    expect(callArg.fileUrl).toBeUndefined();
    expect(callArg.fileContent).toBe(baseCsv.content);
  });

  // ─── INV-T-095d: erro na geração do relatório ────────────────────────────

  it('INV-T-095d: quando geração de relatório falha, chama failJob e re-lança o erro', async () => {
    (generateReportUseCase.execute as jest.Mock).mockRejectedValue(
      new Error('DB query failed'),
    );
    const job = makeJob('export-inventory-report-csv', basePayload);

    await expect(processor.process(job)).rejects.toThrow('DB query failed');

    expect(asyncJobsService.failJob).toHaveBeenCalledWith(
      'job-001',
      'DB query failed',
    );
    expect(asyncJobsService.completeJob).not.toHaveBeenCalled();
  });

  // ─── INV-T-095e: sync-inventory-connection job ───────────────────────────

  it('INV-T-095e: sync-inventory-connection job chama SyncInventoryConnectionUseCase e completa', async () => {
    const syncPayload = {
      asyncJobId: 'sync-job-001',
      type: 'SYNC_INVENTORY_CONNECTION' as const,
      tenantId: 'tenant-001',
      connectionId: 'conn-abc',
    };
    const job = makeJob('sync-inventory-connection', syncPayload as any);

    await processor.process(job);

    expect(asyncJobsService.markProcessing).toHaveBeenCalledWith(
      'sync-job-001',
      { progress: 20 },
    );
    expect(syncConnectionUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      connectionId: 'conn-abc',
    });
    expect(asyncJobsService.completeJob).toHaveBeenCalledWith(
      'sync-job-001',
      expect.objectContaining({
        resultSummary: expect.objectContaining({ connectionId: 'conn-abc' }),
      }),
    );
    expect(asyncJobsService.failJob).not.toHaveBeenCalled();
  });

  it('INV-T-095f: sync-inventory-connection job falha → chama failJob e re-lança erro', async () => {
    (syncConnectionUseCase.execute as jest.Mock).mockRejectedValue(
      new Error('Provider timeout'),
    );
    const syncPayload = {
      asyncJobId: 'sync-job-002',
      type: 'SYNC_INVENTORY_CONNECTION' as const,
      tenantId: 'tenant-001',
      connectionId: 'conn-def',
    };
    const job = makeJob('sync-inventory-connection', syncPayload as any);

    await expect(processor.process(job)).rejects.toThrow('Provider timeout');
    expect(asyncJobsService.failJob).toHaveBeenCalledWith(
      'sync-job-002',
      'Provider timeout',
    );
    expect(asyncJobsService.completeJob).not.toHaveBeenCalled();
  });

  // ─── INV-T-095g: parâmetros de filtro passados ao use case ───────────────

  it('INV-T-095g: repassa query, availableOnly e statuses ao GenerateInventoryReportUseCase', async () => {
    const payload = {
      ...basePayload,
      query: 'camiseta',
      availableOnly: true,
      statuses: ['AVAILABLE', 'LOW_STOCK'] as Array<
        'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED'
      >,
    };
    const job = makeJob('export-inventory-report-csv', payload);

    await processor.process(job);

    expect(generateReportUseCase.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      query: 'camiseta',
      availableOnly: true,
      statuses: ['AVAILABLE', 'LOW_STOCK'],
    });
  });
});
