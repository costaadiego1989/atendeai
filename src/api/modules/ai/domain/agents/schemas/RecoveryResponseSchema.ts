import { z } from 'zod';
import { BaseAgentResponseSchema } from './BaseAgentResponseSchema';

export const RecoveryResponseSchema = BaseAgentResponseSchema.extend({
  debtAcknowledged: z
    .boolean()
    .optional()
    .describe('Cliente reconheceu o débito'),
  proposedPaymentPlan: z
    .string()
    .optional()
    .describe('Plano de pagamento proposto (ex: "3x de R$150")'),
  negotiationStatus: z
    .enum(['OPEN', 'AGREED', 'REJECTED', 'PENDING'])
    .optional()
    .describe('Status atual da negociação'),
});

export type RecoveryResponse = z.infer<typeof RecoveryResponseSchema>;
