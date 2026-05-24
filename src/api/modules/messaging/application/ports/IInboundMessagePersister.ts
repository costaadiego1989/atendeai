import { Prisma } from '@prisma/client';
import { IntegrationEvent } from '@shared/infrastructure/event-bus';
import { ProcessInboundMessageInput } from '../use-cases/interfaces/IProcessInboundMessageUseCase';

export const INBOUND_MESSAGE_PERSISTER = 'INBOUND_MESSAGE_PERSISTER';

export interface IInboundMessagePersister {
  /**
   * Runs the inbound pipeline inside a transaction owned by the caller.
   * The caller MUST provide and commit/rollback `options.tx`; this method
   * never opens or closes a transaction itself. The returned integration
   * events MUST be published by the caller within the same transaction.
   */
  persistInboundMessage(
    input: ProcessInboundMessageInput,
    options: { tx: Prisma.TransactionClient; skipDuplicateCheck?: boolean },
  ): Promise<IntegrationEvent[]>;
}
