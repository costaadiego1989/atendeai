import { Prisma } from '@prisma/client';

export type ConversationSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface ConversationIntelligenceRecord {
  tenantId: string;
  conversationId: string;
  summary: string;
  sentiment: ConversationSentiment;
  tags: string[];
  interests: string[];
  nextStep?: string | null;
  lossReason?: string | null;
  updatedAt: Date;
}

export interface IConversationIntelligenceRepository {
  save(
    record: Omit<ConversationIntelligenceRecord, 'updatedAt'>,
    options?: { tx?: Prisma.TransactionClient },
  ): Promise<void>;
  findByConversationIds(
    tenantId: string,
    conversationIds: string[],
  ): Promise<Record<string, ConversationIntelligenceRecord>>;
}

export const CONVERSATION_INTELLIGENCE_REPOSITORY = Symbol(
  'IConversationIntelligenceRepository',
);
