export interface GeneratePaymentLinkInput {
  tenantId: string;
  name: string;
  value: number;
}

export interface GeneratePaymentLinkOutput {
  id: string;
  url: string;
}

export interface IPaymentLinkGenerator {
  generate(input: GeneratePaymentLinkInput): Promise<GeneratePaymentLinkOutput>;
}

export const PAYMENT_LINK_GENERATOR = Symbol('PAYMENT_LINK_GENERATOR');
