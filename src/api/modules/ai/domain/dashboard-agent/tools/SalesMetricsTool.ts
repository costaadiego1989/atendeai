import { z } from 'zod';
import { IDashboardMetricsProvider } from '../../../application/ports/dashboard/IDashboardMetricsProvider';

const { tool } = require('@langchain/core/tools');

export function createSalesMetricsTool(metricsProvider: IDashboardMetricsProvider) {
  return tool(
    async ({ period, groupBy }: { period: string; groupBy?: string }, runConfig: any) => {
      const tenantId = runConfig?.configurable?.tenantId;
      if (!tenantId) {
        return JSON.stringify({ error: 'Contexto do tenant não disponível' });
      }
      try {
        const data = await metricsProvider.getRevenue(tenantId, period, groupBy);
        return JSON.stringify(data);
      } catch (error: any) {
        return JSON.stringify({ error: `Erro ao consultar métricas de vendas: ${error.message}` });
      }
    },
    {
      name: 'sales_metrics',
      description: 'Consulta métricas de vendas e receita do negócio. Use para responder sobre faturamento, ticket médio, quantidade de vendas, e comparativos por período. Períodos disponíveis: today, yesterday, this_week, last_week, this_month, last_month, last_30_days.',
      schema: z.object({
        period: z.enum(['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'last_30_days'])
          .describe('Período para consulta das métricas'),
        groupBy: z.enum(['day', 'week', 'month', 'product', 'seller']).optional()
          .describe('Agrupar resultados por: dia, semana, mês, produto ou vendedor'),
      }),
    }
  );
}
