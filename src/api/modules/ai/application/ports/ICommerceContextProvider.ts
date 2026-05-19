export interface FindCommerceConversationContextInput {
  tenantId: string;
  conversationId: string;
  userMessage: string;
  businessType?: string | null;
}

export interface ICommerceContextProvider {
  findConversationContext(
    input: FindCommerceConversationContextInput,
  ): Promise<string | null>;
  getCatalogItemCount(tenantId: string): Promise<number>;
}

export const COMMERCE_CONTEXT_PROVIDER = 'COMMERCE_CONTEXT_PROVIDER';
