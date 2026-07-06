import { z } from 'zod';

export const PaymentLinkSuggestionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  label: z.string().max(100).optional(),
  value: z.number().positive(),
  billingType: z.enum(['PIX', 'CREDIT_CARD', 'BOLETO', 'UNDEFINED']),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export type PaymentLinkSuggestion = z.infer<typeof PaymentLinkSuggestionSchema>;
