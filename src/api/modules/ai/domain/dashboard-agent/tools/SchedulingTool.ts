import { z } from 'zod';
import { ISchedulingMetricsProvider } from '../../../application/ports/dashboard/ISchedulingMetricsProvider';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { tool } = require('@langchain/core/tools');

export function createSchedulingTool(provider: ISchedulingMetricsProvider) {
  return tool(
    async ({ period }: { period: string }, runConfig: any) => {
      const tenantId = runConfig?.configurable?.tenantId;
      if (!tenantId) {
        return JSON.stringify({ error: 'Contexto do tenant não disponível' });
      }
      try {
        const data = await provider.getMetrics(tenantId, period);
        return JSON.stringify(data);
      } catch (error: any) {
        return JSON.stringify({ error: `Erro ao consultar agendamentos: ${error.message}` });
      }
    },
    {
      name: 'scheduling',
      description: 'Consulta métricas de agendamento: taxa de ocupação, horários vagos, próximos agendamentos com nome do cliente e serviço, cancelamentos e no-shows do período.',
      schema: z.object({
        period: z.enum(['today', 'tomorrow', 'this_week', 'next_week', 'this_month'])
          .describe('Período para consulta da agenda'),
      }),
    }
  );
}
