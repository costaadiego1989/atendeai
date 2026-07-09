import { z } from 'zod';
import { IRecoveryMetricsProvider } from '../../../application/ports/dashboard/IRecoveryMetricsProvider';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { tool } = require('@langchain/core/tools');

export function createRecoveryStatusTool(provider: IRecoveryMetricsProvider) {
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
        return JSON.stringify({ error: `Erro ao consultar recuperação: ${error.message}` });
      }
    },
    {
      name: 'recovery_status',
      description: 'Consulta métricas de recuperação de vendas/cobrança: total em aberto vs recuperado, taxa de conversão das tentativas, maiores devedores com valor e dias em atraso, próximas cobranças programadas.',
      schema: z.object({
        period: z.enum(['today', 'this_week', 'this_month', 'last_30_days'])
          .describe('Período para análise de recuperação'),
      }),
    }
  );
}
