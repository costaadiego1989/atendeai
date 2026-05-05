export const GET_CONVERSATION_SALE_ATTRIBUTION_USE_CASE = Symbol(
  'IGetConversationSaleAttributionUseCase',
);

export interface GetConversationSaleAttributionInput {
  tenantId: string;
  conversationId: string;
}

export interface ConversationSaleAttributionDTO {
  id: string;
  conversationId: string;
  attributedUserId: string;
  saleAmount: string | null;
  currency: string | null;
  lifecycleStatus: string;
  aiValidationStatus: string;
  markedByUserId: string;
  markedAt: string;
  aiValidatedAt: string | null;
  notes: string | null;
}

export interface IGetConversationSaleAttributionUseCase {
  execute(
    input: GetConversationSaleAttributionInput,
  ): Promise<ConversationSaleAttributionDTO | null>;
}
