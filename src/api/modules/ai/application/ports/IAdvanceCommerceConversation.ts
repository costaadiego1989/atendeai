/**
 * Port interface for commerce conversation advancement.
 * Used by the AI module to advance commerce conversation state
 * without depending on the concrete Commerce use case.
 */
export interface IAdvanceCommerceConversation {
  execute(input: AdvanceCommerceConversationInput): Promise<unknown>;
}

export interface AdvanceCommerceConversationInput {
  tenantId: string;
  branchId?: string | null;
  conversationId: string;
  contactId?: string | null;
  businessType?: string | null;
  userMessage: string;
}

export const ADVANCE_COMMERCE_CONVERSATION = Symbol(
  'ADVANCE_COMMERCE_CONVERSATION',
);
