import { IUseCase } from '@shared/application/IUseCase';

export interface MarkConversationReadInput {
  tenantId: string;
  conversationId: string;
}

export interface MarkConversationReadOutput {
  success: true;
}

export interface IMarkConversationReadUseCase
  extends IUseCase<MarkConversationReadInput, MarkConversationReadOutput> {}

export const IMarkConversationReadUseCase = Symbol('IMarkConversationReadUseCase');
