export const MARK_CONVERSATION_SALE_USE_CASE = Symbol(
  'IMarkConversationSaleUseCase',
);

export interface MarkConversationSaleInput {
  tenantId: string;
  conversationId: string;
  actorUserId: string;
  actorRole: string;
  attributedUserId?: string;
  saleAmount?: number | null;
  currency?: string | null;
  notes?: string | null;
}

export interface MarkConversationSaleOutput {
  approved: boolean;
  reason?: string;
  confidence?: number;
  id?: string;
  conversationId: string;
  attributedUserId?: string;
  saleAmount?: string | null;
  currency?: string | null;
  lifecycleStatus?: string;
  aiValidationStatus?: string;
  markedByUserId?: string;
  markedAt?: string;
  aiValidatedAt?: string | null;
  notes?: string | null;
  commercialKind?: string | null;
  commercialStatus?: string | null;
  evidenceSource?: string | null;
}

export interface IMarkConversationSaleUseCase {
  execute(input: MarkConversationSaleInput): Promise<MarkConversationSaleOutput>;
}
