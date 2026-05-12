import { Prisma } from '@prisma/client';
import { IntegrationEvent } from '@shared/infrastructure/event-bus';
import { Conversation } from '../../../domain/entities/Conversation';
import { Message } from '../../../domain/entities/Message';
import { ProcessInboundMessageInput } from '../../use-cases/interfaces/IProcessInboundMessageUseCase';

export interface InboundMessageContext {
  input: ProcessInboundMessageInput;
  tx?: Prisma.TransactionClient;
  skipDuplicateCheck?: boolean;

  // Enriched by DeduplicateMessageStep
  isDuplicate?: boolean;

  // Enriched by IdentifyContactStep
  contactId?: string;
  branchId?: string | null;

  // Enriched by EnsureConversationStep
  conversation?: Conversation;
  isNewConversation?: boolean;
  shouldReleaseAssignment?: boolean;

  // Enriched by PersistMessageStep
  message?: Message;
  signalText?: string;

  // Enriched by AnalyzeMessageStep (intelligence captured)
  intelligenceCaptured?: boolean;

  // Collected events
  events: IntegrationEvent[];
}
