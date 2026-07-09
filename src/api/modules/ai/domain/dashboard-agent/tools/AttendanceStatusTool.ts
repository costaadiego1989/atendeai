import { z } from 'zod';
import { IAttendanceMetricsProvider } from '../../../application/ports/dashboard/IAttendanceMetricsProvider';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { tool } = require('@langchain/core/tools');

export function createAttendanceStatusTool(provider: IAttendanceMetricsProvider) {
  return tool(
    async (_input: Record<string, never>, runConfig: any) => {
      const tenantId = runConfig?.configurable?.tenantId;
      if (!tenantId) {
        return JSON.stringify({ error: 'Contexto do tenant não disponível' });
      }
      try {
        const data = await provider.getStatus(tenantId);
        return JSON.stringify(data);
      } catch (error: any) {
        return JSON.stringify({ error: `Erro ao consultar status de atendimentos: ${error.message}` });
      }
    },
    {
      name: 'attendance_status',
      description: 'Consulta o status de atendimentos em tempo real. Retorna: conversas ativas, fila de espera, aguardando humano, tempo médio de resposta (IA e humano), distribuição por canal (WhatsApp, Instagram), e atendimentos por agente.',
      schema: z.object({}),
    }
  );
}
