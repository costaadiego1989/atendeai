export const UPDATE_CONVERSATION_SALE_ATTRIBUTION_USE_CASE = Symbol(
  'IUpdateConversationSaleAttributionUseCase',
);

export interface UpdateConversationSaleAttributionInput {
  tenantId: string;
  conversationId: string;
  actorUserId: string;
  actorRole: string;
  saleAmount?: number | null;
  notes?: string | null;
}

export interface UpdateConversationSaleAttributionOutput {
  id: string;
  saleAmount: string | null;
  notes: string | null;
}

export interface IUpdateConversationSaleAttributionUseCase {
  execute(
    input: UpdateConversationSaleAttributionInput,
  ): Promise<UpdateConversationSaleAttributionOutput>;
}
