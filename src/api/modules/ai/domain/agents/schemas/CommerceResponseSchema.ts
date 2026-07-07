import { z } from 'zod';
import { BaseAgentResponseSchema } from './BaseAgentResponseSchema';

export const CommerceResponseSchema = BaseAgentResponseSchema.extend({
  orderItems: z
    .array(z.string())
    .optional()
    .describe('Itens mencionados ou adicionados ao pedido'),
  orderTotal: z.number().optional().describe('Valor total do pedido atual'),
  deliveryEstimate: z
    .string()
    .optional()
    .describe('Previsão de entrega (ex: "30-45 minutos")'),
});

export type CommerceResponse = z.infer<typeof CommerceResponseSchema>;
