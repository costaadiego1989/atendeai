import { Job } from 'bullmq';

export function buildQueueTelemetry(
  queueName: string,
  job: Job,
  status: 'processing' | 'completed' | 'failed',
  extras?: Record<string, unknown>,
) {
  const enqueuedAt = typeof job.timestamp === 'number' ? job.timestamp : Date.now();
  const startedAt = typeof job.processedOn === 'number' ? job.processedOn : Date.now();
  const finishedAt = Date.now();

  return {
    queueName,
    status,
    jobId: String(job.id ?? ''),
    name: job.name,
    attemptsMade: job.attemptsMade,
    delayMs: startedAt - enqueuedAt,
    processingMs: finishedAt - startedAt,
    ...extras,
  };
}
