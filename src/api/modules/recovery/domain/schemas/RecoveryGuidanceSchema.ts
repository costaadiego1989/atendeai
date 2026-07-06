import { z } from 'zod';

export const RecoveryGuidanceSchema = z.object({
  suggestedReply: z
    .string()
    .min(1)
    .describe(
      'Mensagem curta, educada e persuasiva para enviar ao devedor via WhatsApp',
    ),
  suggestedNextAction: z
    .string()
    .min(1)
    .describe('Próximo passo operacional para o agente de cobrança'),
});

export type RecoveryGuidanceOutput = z.infer<typeof RecoveryGuidanceSchema>;
