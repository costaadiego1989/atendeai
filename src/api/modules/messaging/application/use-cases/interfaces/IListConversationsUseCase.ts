import { IUseCase } from '@shared/application/IUseCase';

export interface ListConversationsInput {
  tenantId: string;
  branchId?: string;
  page?: number;
  limit?: number;
  status?: string;
  requesterUserId?: string;
  requesterRole?: string;
}

export interface ListConversationsOutput {
  data: {
    id: string;
    contactId: string;
    contactName: string;
    contactPhone: string;
    channel: string;
    status: string;
    assignedToUserId?: string;
    assignedToName?: string;
    assignedAt?: Date;
    unreadCount: number;
    createdAt: Date;
    updatedAt: Date;
    lastInboundAt?: Date;
    lastOutboundAt?: Date;
    lastMessage?: {
      content: string;
      direction: string;
      timestamp: Date;
    };
    lastMessageSequence?: number;
    intelligence?: {
      summary: string;
      sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
      tags: string[];
      interests: string[];
      nextStep?: string | null;
      lossReason?: string | null;
      updatedAt: Date;
    };
  }[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IListConversationsUseCase extends IUseCase<
  ListConversationsInput,
  ListConversationsOutput
> {}
export const IListConversationsUseCase = Symbol('IListConversationsUseCase');
