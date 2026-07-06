import { z } from 'zod';

export const SaleValidationSchema = z.object({
  approved: z
    .boolean()
    .describe(
      'true se há evidência clara de venda concretizada na conversa',
    ),
  reason: z
    .string()
    .min(1)
    .max(500)
    .describe('Justificativa curta em português'),
  confidence: z.number().min(0).max(1),
});

export type SaleValidationResult = z.infer<typeof SaleValidationSchema>;
