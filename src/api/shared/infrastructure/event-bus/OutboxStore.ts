import { Prisma } from '@prisma/client';
import { IntegrationEvent } from '../../application/ports/IntegrationEvent';

export interface StoredOutboxEvent {
  id: string;
  eventId: string;
  eventType: string;
  queue: string;
  sourceModule: string;
  payload: Record<string, unknown>;
  timestamp: string;
  attemptCount: number;
  createdAt: Date;
}

export interface IOutboxStore {
  append(
    event: IntegrationEvent,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  claimPending(batchSize: number): Promise<StoredOutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string, errorMessage: string): Promise<void>;
}
