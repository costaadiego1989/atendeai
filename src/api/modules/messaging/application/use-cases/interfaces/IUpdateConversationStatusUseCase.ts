import { IUseCase } from '@shared/application/IUseCase';

export interface UpdateConversationStatusInput {
  tenantId: string;
  conversationId: string;
  status: 'ACTIVE' | 'PENDING_HUMAN' | 'ARCHIVED';
  actorUserId?: string;
}

export interface UpdateConversationStatusOutput {
  id: string;
  status: 'ACTIVE' | 'PENDING_HUMAN' | 'ARCHIVED';
}

export interface IUpdateConversationStatusUseCase extends IUseCase<
  UpdateConversationStatusInput,
  UpdateConversationStatusOutput
> {}

export const IUpdateConversationStatusUseCase = Symbol(
  'IUpdateConversationStatusUseCase',
);
