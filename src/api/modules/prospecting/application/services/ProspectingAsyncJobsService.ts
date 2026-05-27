import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IProspectAsyncJobRepository,
  PROSPECT_ASYNC_JOB_REPOSITORY,
  ProspectingAsyncJobStatus,
  ProspectingAsyncJobType,
  ProspectingAsyncJobView,
} from '../../domain/repositories/IProspectAsyncJobRepository';

export {
  ProspectingAsyncJobStatus,
  ProspectingAsyncJobType,
  ProspectingAsyncJobView,
};

@Injectable()
export class ProspectingAsyncJobsService {
  constructor(
    @Inject(PROSPECT_ASYNC_JOB_REPOSITORY)
    private readonly repo: IProspectAsyncJobRepository,
  ) {}

  async createJob(input: {
    tenantId: string;
    type: ProspectingAsyncJobType;
    requestedByUserId?: string;
    requestedByUserEmail?: string;
    payload: Record<string, unknown>;
    totalItems?: number;
  }): Promise<ProspectingAsyncJobView> {
    return this.repo.create(input);
  }

  async attachQueueJobId(jobId: string, queueJobId: string): Promise<void> {
    await this.repo.attachQueueJobId(jobId, queueJobId);
  }

  async markProcessing(
    jobId: string,
    input?: { progress?: number; totalItems?: number },
  ) {
    await this.repo.markProcessing(jobId, input);
  }

  async completeJob(
    jobId: string,
    input: {
      processedItems?: number;
      totalItems?: number;
      resultSummary?: Record<string, unknown>;
      fileName?: string;
      fileMimeType?: string;
      fileUrl?: string;
      fileContent?: string;
    },
  ) {
    await this.repo.complete(jobId, input);
  }

  async failJob(jobId: string, errorMessage: string) {
    await this.repo.fail(jobId, errorMessage);
  }

  async listJobs(
    tenantId: string,
    limit = 15,
  ): Promise<ProspectingAsyncJobView[]> {
    return this.repo.findByTenant(tenantId, limit);
  }

  async getJob(
    tenantId: string,
    jobId: string,
  ): Promise<ProspectingAsyncJobView> {
    const job = await this.repo.findOne(tenantId, jobId);

    if (!job) {
      throw new EntityNotFoundException('ProspectingAsyncJob', jobId);
    }

    return job;
  }

  async getDownloadPayload(tenantId: string, jobId: string) {
    const payload = await this.repo.getDownloadPayload(tenantId, jobId);

    if (!payload) {
      throw new EntityNotFoundException('ProspectingAsyncJob', jobId);
    }

    return payload;
  }
}
