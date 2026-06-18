import { ContactAsyncJobsService } from '../infrastructure/persistence/repositories/ContactAsyncJobsService';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';

describe('ContactAsyncJobsService', () => {
  let service: ContactAsyncJobsService;
  let mockPrisma: jest.Mocked<PrismaService>;

  const tenantId = '123e4567-e89b-12d3-a456-426614174000';

  const makeJobRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'job-1',
    tenant_id: tenantId,
    branch_id: null,
    type: 'IMPORT_CONTACTS',
    status: 'QUEUED',
    requested_by_user_id: null,
    requested_by_user_email: null,
    payload: {},
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
    mockPrisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    } as any;

    service = new ContactAsyncJobsService(mockPrisma);
  });

  it('should create a job record', async () => {
    const row = makeJobRow();
    mockPrisma.$queryRaw.mockResolvedValue([row]);

    const result = await service.createJob({
      tenantId,
      type: 'IMPORT_CONTACTS',
      payload: { source: 'csv' },
    });

    expect(result.id).toBe('job-1');
    expect(result.tenantId).toBe(tenantId);
    expect(result.type).toBe('IMPORT_CONTACTS');
    expect(result.status).toBe('QUEUED');
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should update job status to PROCESSING', async () => {
    mockPrisma.$executeRaw.mockResolvedValue(1);

    await service.markProcessing('job-1', { progress: 25 });

    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('should complete a job with result payload', async () => {
    mockPrisma.$executeRaw.mockResolvedValue(1);

    await service.completeJob('job-1', {
      processedItems: 50,
      totalItems: 50,
      resultSummary: { created: 45, skipped: 5 },
      fileName: 'report.csv',
      fileMimeType: 'text/csv',
    });

    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('should get job by id for a tenant', async () => {
    const row = makeJobRow({ status: 'COMPLETED', progress: 100 });
    mockPrisma.$queryRaw.mockResolvedValue([row]);

    const result = await service.getJob(tenantId, 'job-1');

    expect(result.id).toBe('job-1');
    expect(result.status).toBe('COMPLETED');
    expect(result.progress).toBe(100);
  });

  it('should throw EntityNotFoundException when job not found', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);

    await expect(service.getJob(tenantId, 'non-existent')).rejects.toThrow(
      EntityNotFoundException,
    );
  });

  it('should list jobs for a tenant', async () => {
    const rows = [
      makeJobRow({ id: 'job-1', status: 'COMPLETED' }),
      makeJobRow({ id: 'job-2', status: 'QUEUED' }),
    ];
    mockPrisma.$queryRaw.mockResolvedValue(rows);

    const result = await service.listJobs(tenantId);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('job-1');
    expect(result[1].id).toBe('job-2');
  });

  it('should fail a job with error message', async () => {
    mockPrisma.$executeRaw.mockResolvedValue(1);

    await service.failJob('job-1', 'Something went wrong');

    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
