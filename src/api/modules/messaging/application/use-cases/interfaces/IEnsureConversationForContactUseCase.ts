import { IUseCase } from '@shared/application/IUseCase';

export interface EnsureConversationForContactInput {
  tenantId: string;
  contactId: string;
  channel?: 'WHATSAPP' | 'INSTAGRAM';
}

export interface EnsureConversationForContactOutput {
  conversationId: string;
  contactId: string;
  channel: 'WHATSAPP' | 'INSTAGRAM';
  status: 'ACTIVE' | 'PENDING_HUMAN' | 'ARCHIVED';
  created: boolean;
}

export interface IEnsureConversationForContactUseCase
  extends IUseCase<
    EnsureConversationForContactInput,
    EnsureConversationForContactOutput
  > {}

export const IEnsureConversationForContactUseCase = Symbol(
  'IEnsureConversationForContactUseCase',
);
