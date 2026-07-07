import { z } from 'zod';

export const ScheduleSlotToolSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Data do agendamento no formato YYYY-MM-DD'),
  professionalId: z
    .string()
    .optional()
    .describe('ID do profissional (opcional)'),
  slotId: z
    .string()
    .optional()
    .describe('ID do slot específico (opcional)'),
  categoryId: z
    .string()
    .optional()
    .describe('ID da categoria/serviço (opcional)'),
  payment: z
    .enum(['required', 'not_required'])
    .default('not_required')
    .describe('Se pagamento é obrigatório para confirmar'),
});

export type ScheduleSlotToolInput = z.infer<typeof ScheduleSlotToolSchema>;
