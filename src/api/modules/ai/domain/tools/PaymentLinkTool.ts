import { z } from 'zod';

export const PaymentLinkToolSchema = z.object({
  productName: z
    .string()
    .min(1)
    .describe('Nome do produto ou serviço para gerar link de pagamento'),
  value: z.number().positive().describe('Valor em reais (ex: 99.90)'),
});

export type PaymentLinkToolInput = z.infer<typeof PaymentLinkToolSchema>;
