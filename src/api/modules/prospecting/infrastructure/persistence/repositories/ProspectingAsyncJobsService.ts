import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  CompleteProspectingAsyncJobInput,
  IProspectAsyncJobRepository,
  PROSPECT_ASYNC_JOB_REPOSITORY,
  ProspectingAsyncJobStatus,
  ProspectingAsyncJobType,
  ProspectingAsyncJobView,
} from '../../../domain/repositories/IProspectAsyncJobRepository';

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

  async attachQueueJobId(
    tenantId: string,
    jobId: string,
    queueJobId: string,
  ): Promise<void> {
    await this.repo.attachQueueJobId(tenantId, jobId, queueJobId);
  }

  async markProcessing(
    tenantId: string,
    jobId: string,
    input?: { progress?: number; totalItems?: number },
  ) {
    await this.repo.markProcessing(tenantId, jobId, input);
  }

  async completeJob(
    tenantId: string,
    jobId: string,
    input: CompleteProspectingAsyncJobInput,
  ) {
    await this.repo.complete(tenantId, jobId, input);
  }

  async failJob(tenantId: string, jobId: string, errorMessage: string) {
    await this.repo.fail(tenantId, jobId, errorMessage);
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
