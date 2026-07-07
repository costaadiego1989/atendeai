import { z } from 'zod';

export const TriggerAutomationToolSchema = z.object({
  automationId: z
    .string()
    .uuid()
    .describe('ID (UUID) da automação a ser disparada'),
});

export type TriggerAutomationToolInput = z.infer<
  typeof TriggerAutomationToolSchema
>;
