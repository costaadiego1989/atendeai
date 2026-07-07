import { z } from 'zod';

export const RepeatOrderToolSchema = z.object({
  confirm: z
    .boolean()
    .describe('true quando cliente confirma que deseja repetir o último pedido'),
});

export type RepeatOrderToolInput = z.infer<typeof RepeatOrderToolSchema>;
