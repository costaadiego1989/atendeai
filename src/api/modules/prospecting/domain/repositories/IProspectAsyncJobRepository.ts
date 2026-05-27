export type ProspectingAsyncJobType =
  | 'EXPORT_PROSPECT_SEARCHES_CSV'
  | 'EXPORT_PROSPECT_CAMPAIGNS_CSV';
export type ProspectingAsyncJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export interface ProspectingAsyncJobView {
  id: string;
  tenantId: string;
  type: ProspectingAsyncJobType;
  status: ProspectingAsyncJobStatus;
  requestedByUserId?: string | null;
  requestedByUserEmail?: string | null;
  progress: number;
  totalItems: number;
  processedItems: number;
  resultSummary?: Record<string, unknown>;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileUrl?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  failedAt?: Date | null;
}

export interface ProspectingAsyncJobDownloadPayload {
  fileName: string;
  fileMimeType: string;
  fileContent: string | null;
  fileUrl: string | null;
}

export interface CreateProspectingAsyncJobInput {
  tenantId: string;
  type: ProspectingAsyncJobType;
  requestedByUserId?: string;
  requestedByUserEmail?: string;
  payload: Record<string, unknown>;
  totalItems?: number;
}

export interface MarkProcessingProspectingAsyncJobInput {
  progress?: number;
  totalItems?: number;
}

export interface CompleteProspectingAsyncJobInput {
  processedItems?: number;
  totalItems?: number;
  resultSummary?: Record<string, unknown>;
  fileName?: string;
  fileMimeType?: string;
  fileUrl?: string;
  fileContent?: string;
}

export interface IProspectAsyncJobRepository {
  create(
    input: CreateProspectingAsyncJobInput,
  ): Promise<ProspectingAsyncJobView>;
  attachQueueJobId(jobId: string, queueJobId: string): Promise<void>;
  markProcessing(
    jobId: string,
    input?: MarkProcessingProspectingAsyncJobInput,
  ): Promise<void>;
  complete(
    jobId: string,
    input: CompleteProspectingAsyncJobInput,
  ): Promise<void>;
  fail(jobId: string, errorMessage: string): Promise<void>;
  findByTenant(
    tenantId: string,
    limit?: number,
  ): Promise<ProspectingAsyncJobView[]>;
  findOne(
    tenantId: string,
    jobId: string,
  ): Promise<ProspectingAsyncJobView | null>;
  getDownloadPayload(
    tenantId: string,
    jobId: string,
  ): Promise<ProspectingAsyncJobDownloadPayload | null>;
}

export const PROSPECT_ASYNC_JOB_REPOSITORY = Symbol(
  'IProspectAsyncJobRepository',
);
