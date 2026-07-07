import { z } from 'zod';

export const BaseAgentResponseSchema = z.object({
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
  phase: z
    .string()
    .optional()
    .describe('Fase sugerida para próximo estado da conversa'),
  phaseConfidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Confiança na classificação de fase (0.0 a 1.0)'),
});

export type BaseAgentResponse = z.infer<typeof BaseAgentResponseSchema>;
