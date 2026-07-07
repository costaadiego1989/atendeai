import { z } from 'zod';
import { BaseAgentResponseSchema } from './BaseAgentResponseSchema';

export const SchedulingResponseSchema = BaseAgentResponseSchema.extend({
  suggestedDate: z
    .string()
    .optional()
    .describe('Data sugerida para agendamento (YYYY-MM-DD)'),
  suggestedProfessional: z
    .string()
    .optional()
    .describe('Nome ou ID do profissional sugerido'),
  appointmentConfirmed: z
    .boolean()
    .optional()
    .describe('Agendamento foi confirmado neste turno'),
});

export type SchedulingResponse = z.infer<typeof SchedulingResponseSchema>;
