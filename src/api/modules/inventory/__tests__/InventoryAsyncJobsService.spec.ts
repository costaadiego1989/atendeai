import { InventoryAsyncJobsService } from '../application/services/InventoryAsyncJobsService';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';

describe('InventoryAsyncJobsService', () => {
  let service: InventoryAsyncJobsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockJobRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'job-1',
    tenant_id: 'tenant-1',
    type: 'EXPORT_INVENTORY_REPORT_CSV',
    status: 'QUEUED',
    requested_by_user_id: 'user-1',
    requested_by_user_email: 'user@test.com',
    payload: { filters: {} },
    progress: 0,
    total_items: 0,
    processed_items: 0,
    result_summary: {},
    file_name: null,
    file_mime_type: null,
    file_url: null,
    file_content: null,
    error_message: null,
    queue_job_id: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    completed_at: null,
    failed_at: null,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;
    service = new InventoryAsyncJobsService(prisma);
  });

  it('should create a job record with QUEUED status', async () => {
    const row = mockJobRow();
    prisma.$queryRaw.mockResolvedValue([row]);

    const result = await service.createJob({
      tenantId: 'tenant-1',
      type: 'EXPORT_INVENTORY_REPORT_CSV',
      requestedByUserId: 'user-1',
      requestedByUserEmail: 'user@test.com',
      payload: { filters: {} },
    });

    expect(result.id).toBe('job-1');
    expect(result.status).toBe('QUEUED');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.type).toBe('EXPORT_INVENTORY_REPORT_CSV');
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('should markProcessing update status via raw query', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    await service.markProcessing('job-1', { progress: 50 });

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('should completeJob update status via raw query', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    await service.completeJob('job-1', {
      processedItems: 100,
      totalItems: 100,
      resultSummary: { totalExported: 100 },
      fileName: 'report.csv',
      fileMimeType: 'text/csv;charset=utf-8',
      fileContent: 'csv-content',
    });

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('should failJob update status via raw query', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    await service.failJob('job-1', 'Something went wrong');

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('should getDownloadPayload return file data for completed job', async () => {
    const row = mockJobRow({
      status: 'COMPLETED',
      file_name: 'relatorio-estoque-2024-01-01.csv',
      file_mime_type: 'text/csv;charset=utf-8',
      file_content: 'csv-data-here',
      file_url: null,
    });
    prisma.$queryRaw.mockResolvedValue([row]);

    const result = await service.getDownloadPayload('tenant-1', 'job-1');

    expect(result.fileName).toBe('relatorio-estoque-2024-01-01.csv');
    expect(result.fileMimeType).toBe('text/csv;charset=utf-8');
    expect(result.fileContent).toBe('csv-data-here');
  });

  it('should getDownloadPayload throw EntityNotFoundException when job not found or not completed', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(service.getDownloadPayload('tenant-1', 'job-999')).rejects.toThrow(
      EntityNotFoundException,
    );
  });
});
