/**
 * Port interface for repeating the last commerce order.
 * Used by the AI module to trigger order repetition
 * without depending on the concrete Commerce use case.
 */
export interface IRepeatLastOrder {
  execute(input: RepeatLastOrderInput): Promise<RepeatLastOrderOutput>;
}

export interface RepeatLastOrderInput {
  tenantId: string;
  contactId: string;
  conversationId: string;
  branchId?: string | null;
}

export interface RepeatLastOrderOutput {
  session: {
    id: string;
    subtotalAmount: number;
    totalAmount: number;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number | null;
      lineTotal: number;
    }>;
  };
  previousOrderId: string;
  itemsCopied: number;
}

export const REPEAT_LAST_ORDER = Symbol('REPEAT_LAST_ORDER');
