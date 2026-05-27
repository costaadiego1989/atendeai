import { InventoryAsyncJobsService } from '../application/services/InventoryAsyncJobsService';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';

describe('InventoryAsyncJobsService', () => {
  let service: InventoryAsyncJobsService;
  let inventoryAsyncJob: {
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };

  const mockJob = (overrides: Record<string, unknown> = {}) => ({
    id: 'job-1',
    tenantId: 'tenant-1',
    type: 'EXPORT_INVENTORY_REPORT_CSV',
    status: 'QUEUED',
    requestedByUserId: 'user-1',
    requestedByUserEmail: 'user@test.com',
    payload: { filters: {} },
    progress: 0,
    totalItems: 0,
    processedItems: 0,
    resultSummary: {},
    fileName: null,
    fileMimeType: null,
    fileUrl: null,
    fileContent: null,
    errorMessage: null,
    queueJobId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    completedAt: null,
    failedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    inventoryAsyncJob = {
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(mockJob()),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    };
    const prisma = { inventoryAsyncJob } as unknown as PrismaService;
    service = new InventoryAsyncJobsService(prisma);
  });

  it('should create a job record with QUEUED status (view shape parity)', async () => {
    inventoryAsyncJob.create.mockResolvedValue(mockJob());

    const result = await service.createJob({
      tenantId: 'tenant-1',
      type: 'EXPORT_INVENTORY_REPORT_CSV',
      requestedByUserId: 'user-1',
      requestedByUserEmail: 'user@test.com',
      payload: { filters: {} },
    });

    expect(result).toMatchObject({
      id: 'job-1',
      tenantId: 'tenant-1',
      type: 'EXPORT_INVENTORY_REPORT_CSV',
      status: 'QUEUED',
      requestedByUserId: 'user-1',
      requestedByUserEmail: 'user@test.com',
      progress: 0,
      totalItems: 0,
      processedItems: 0,
    });
    expect(inventoryAsyncJob.create).toHaveBeenCalled();
  });

  it('should markProcessing via typed model', async () => {
    await service.markProcessing('job-1', { progress: 50 });

    expect(inventoryAsyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'PROCESSING', progress: 50 }),
      }),
    );
  });

  it('should completeJob via typed model', async () => {
    await service.completeJob('job-1', {
      processedItems: 100,
      totalItems: 100,
      resultSummary: { totalExported: 100 },
      fileName: 'report.csv',
      fileMimeType: 'text/csv;charset=utf-8',
      fileContent: 'csv-content',
    });

    expect(inventoryAsyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          progress: 100,
          fileContent: 'csv-content',
        }),
      }),
    );
  });

  it('should failJob via typed model', async () => {
    await service.failJob('job-1', 'Something went wrong');

    expect(inventoryAsyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'Something went wrong',
        }),
      }),
    );
  });

  it('should listJobs scoped by tenant', async () => {
    inventoryAsyncJob.findMany.mockResolvedValue([mockJob()]);

    const result = await service.listJobs('tenant-1');

    expect(inventoryAsyncJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
    expect(result).toHaveLength(1);
  });

  it('should getJob throw when not found in tenant', async () => {
    inventoryAsyncJob.findFirst.mockResolvedValue(null);

    await expect(service.getJob('tenant-1', 'job-999')).rejects.toThrow(
      EntityNotFoundException,
    );
    expect(inventoryAsyncJob.findFirst).toHaveBeenCalledWith({
      where: { id: 'job-999', tenantId: 'tenant-1' },
    });
  });

  it('should getDownloadPayload return file data for completed job', async () => {
    inventoryAsyncJob.findFirst.mockResolvedValue(
      mockJob({
        status: 'COMPLETED',
        fileName: 'relatorio-estoque-2024-01-01.csv',
        fileMimeType: 'text/csv;charset=utf-8',
        fileContent: 'csv-data-here',
        fileUrl: null,
      }),
    );

    const result = await service.getDownloadPayload('tenant-1', 'job-1');

    expect(result.fileName).toBe('relatorio-estoque-2024-01-01.csv');
    expect(result.fileMimeType).toBe('text/csv;charset=utf-8');
    expect(result.fileContent).toBe('csv-data-here');
  });

  it('should getDownloadPayload throw EntityNotFoundException when job not found or not completed', async () => {
    inventoryAsyncJob.findFirst.mockResolvedValue(null);

    await expect(
      service.getDownloadPayload('tenant-1', 'job-999'),
    ).rejects.toThrow(EntityNotFoundException);
  });
});
