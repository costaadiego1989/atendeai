export const VOID_CONVERSATION_SALE_USE_CASE = Symbol(
  'IVoidConversationSaleUseCase',
);

export interface VoidConversationSaleInput {
  tenantId: string;
  conversationId: string;
  actorUserId: string;
  actorRole: string;
}

export interface VoidConversationSaleOutput {
  id: string;
  lifecycleStatus: string;
}

export interface IVoidConversationSaleUseCase {
  execute(
    input: VoidConversationSaleInput,
  ): Promise<VoidConversationSaleOutput>;
}
