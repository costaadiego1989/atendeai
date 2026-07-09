import { z } from 'zod';
import { IContactMetricsProvider } from '../../../application/ports/dashboard/IContactMetricsProvider';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { tool } = require('@langchain/core/tools');

export function createContactsCRMTool(provider: IContactMetricsProvider) {
  return tool(
    async ({ action, period, query }: { action: string; period?: string; query?: string }, runConfig: any) => {
      const tenantId = runConfig?.configurable?.tenantId;
      if (!tenantId) {
        return JSON.stringify({ error: 'Contexto do tenant não disponível' });
      }
      try {
        if (action === 'search' && query) {
          const results = await provider.searchContacts(tenantId, query, 10);
          return JSON.stringify({ searchResults: results });
        }
        const data = await provider.getMetrics(tenantId, period || 'this_month');
        return JSON.stringify(data);
      } catch (error: any) {
        return JSON.stringify({ error: `Erro ao consultar contatos: ${error.message}` });
      }
    },
    {
      name: 'contacts_crm',
      description: 'Consulta dados de contatos/CRM: total de contatos, novos no período, distribuição por fase do funil, contatos mais engajados, ou busca por nome/telefone. Use action="metrics" para visão geral ou action="search" com query para buscar contato específico.',
      schema: z.object({
        action: z.enum(['metrics', 'search'])
          .describe('"metrics" para visão geral, "search" para buscar contato por nome/telefone'),
        period: z.enum(['today', 'this_week', 'this_month', 'last_30_days']).optional()
          .describe('Período para métricas (ignorado em search)'),
        query: z.string().optional()
          .describe('Nome ou telefone para busca (obrigatório quando action=search)'),
      }),
    }
  );
}
