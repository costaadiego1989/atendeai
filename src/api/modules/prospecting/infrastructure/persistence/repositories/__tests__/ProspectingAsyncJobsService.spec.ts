import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IProspectAsyncJobRepository,
  ProspectingAsyncJobView,
} from '../../../domain/repositories/IProspectAsyncJobRepository';
import { ProspectingAsyncJobsService } from '../ProspectingAsyncJobsService';

describe('ProspectingAsyncJobsService', () => {
  let repo: jest.Mocked<IProspectAsyncJobRepository>;
  let service: ProspectingAsyncJobsService;

  const view: ProspectingAsyncJobView = {
    id: 'job-1',
    tenantId: 'tenant-1',
    type: 'EXPORT_PROSPECT_SEARCHES_CSV',
    status: 'QUEUED',
    progress: 0,
    totalItems: 0,
    processedItems: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      attachQueueJobId: jest.fn(),
      markProcessing: jest.fn(),
      complete: jest.fn(),
      fail: jest.fn(),
      findByTenant: jest.fn(),
      findOne: jest.fn(),
      getDownloadPayload: jest.fn(),
    };
    service = new ProspectingAsyncJobsService(repo);
  });

  it('delegates createJob to the repository', async () => {
    repo.create.mockResolvedValue(view);

    const input = {
      tenantId: 'tenant-1',
      type: 'EXPORT_PROSPECT_SEARCHES_CSV' as const,
      payload: { foo: 'bar' },
    };
    const result = await service.createJob(input);

    expect(repo.create).toHaveBeenCalledWith(input);
    expect(result).toBe(view);
  });

  it('delegates attachQueueJobId to the repository with tenantId scope', async () => {
    await service.attachQueueJobId('tenant-1', 'job-1', 'queue-1');
    expect(repo.attachQueueJobId).toHaveBeenCalledWith(
      'tenant-1',
      'job-1',
      'queue-1',
    );
  });

  it('delegates markProcessing to the repository with tenantId scope', async () => {
    await service.markProcessing('tenant-1', 'job-1', { progress: 50 });
    expect(repo.markProcessing).toHaveBeenCalledWith('tenant-1', 'job-1', {
      progress: 50,
    });
  });

  it('delegates completeJob to the repository with tenantId scope', async () => {
    const input = { processedItems: 10, fileName: 'report.csv' };
    await service.completeJob('tenant-1', 'job-1', input);
    expect(repo.complete).toHaveBeenCalledWith('tenant-1', 'job-1', input);
  });

  it('delegates failJob to the repository with tenantId scope', async () => {
    await service.failJob('tenant-1', 'job-1', 'boom');
    expect(repo.fail).toHaveBeenCalledWith('tenant-1', 'job-1', 'boom');
  });

  it('delegates listJobs to the repository with the tenant scope', async () => {
    repo.findByTenant.mockResolvedValue([view]);
    const result = await service.listJobs('tenant-1', 5);
    expect(repo.findByTenant).toHaveBeenCalledWith('tenant-1', 5);
    expect(result).toEqual([view]);
  });

  it('returns the job from getJob when found', async () => {
    repo.findOne.mockResolvedValue(view);
    const result = await service.getJob('tenant-1', 'job-1');
    expect(repo.findOne).toHaveBeenCalledWith('tenant-1', 'job-1');
    expect(result).toBe(view);
  });

  it('throws EntityNotFoundException from getJob when missing', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.getJob('tenant-1', 'job-x')).rejects.toBeInstanceOf(
      EntityNotFoundException,
    );
  });

  it('returns the payload from getDownloadPayload when found', async () => {
    const payload = {
      fileName: 'report.csv',
      fileMimeType: 'text/csv;charset=utf-8',
      fileContent: 'a;b',
      fileUrl: null,
    };
    repo.getDownloadPayload.mockResolvedValue(payload);
    const result = await service.getDownloadPayload('tenant-1', 'job-1');
    expect(repo.getDownloadPayload).toHaveBeenCalledWith('tenant-1', 'job-1');
    expect(result).toBe(payload);
  });

  it('throws EntityNotFoundException from getDownloadPayload when missing', async () => {
    repo.getDownloadPayload.mockResolvedValue(null);
    await expect(
      service.getDownloadPayload('tenant-1', 'job-x'),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });
});
