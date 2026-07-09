import { z } from 'zod';
import { ICatalogMetricsProvider } from '../../../application/ports/dashboard/ICatalogMetricsProvider';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { tool } = require('@langchain/core/tools');

export function createCatalogInventoryTool(provider: ICatalogMetricsProvider) {
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
        return JSON.stringify({ error: `Erro ao consultar catálogo/estoque: ${error.message}` });
      }
    },
    {
      name: 'catalog_inventory',
      description: 'Consulta dados do catálogo e estoque: produtos mais vendidos, itens com estoque baixo, pedidos pendentes/em preparo, valor médio do pedido, total de produtos.',
      schema: z.object({
        period: z.enum(['today', 'this_week', 'this_month', 'last_30_days'])
          .describe('Período para análise do catálogo'),
      }),
    }
  );
}
