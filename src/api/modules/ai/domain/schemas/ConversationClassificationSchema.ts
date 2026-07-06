import { z } from 'zod';

export const ConversationClassificationSchema = z.object({
  reply: z
    .string()
    .min(1)
    .describe('Resposta ao cliente em português brasileiro'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confiança do modelo na resposta (0.0 a 1.0)'),
  intent: z
    .enum(['PURCHASE', 'QUESTION', 'COMPLAINT', 'GREETING', 'GENERAL'])
    .describe('Intenção detectada na mensagem do usuário'),
  sentiment: z
    .enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE'])
    .describe('Sentimento detectado na mensagem do usuário'),
});

export type ConversationClassification = z.infer<
  typeof ConversationClassificationSchema
>;
