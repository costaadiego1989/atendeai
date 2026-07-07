import type { AgentDefinition } from '../AgentDefinition';
import { BaseAgentResponseSchema } from '../schemas';
import { TriggerAutomationToolSchema } from '../../tools';

const SUPPORT_PHASES = {
  phases: ['GREETING', 'SUPPORT', 'COMPLAINT'] as readonly string[],
  transitions: {
    GREETING: ['SUPPORT', 'COMPLAINT'],
    SUPPORT: ['GREETING', 'COMPLAINT'],
    COMPLAINT: ['SUPPORT', 'GREETING'],
  } as Record<string, string[]>,
};

export const SupportAgentDefinition: AgentDefinition = {
  id: 'support',
  name: 'Support Agent',
  businessTypes: [],
  intents: ['COMPLAINT'],
  systemPromptTemplate: `[IDENTIDADE]
Você é o agente de suporte de {{tenantName}}. Seu objetivo é resolver problemas e reclamações com empatia e eficiência.

[OBJETIVO]
- Escutar o problema com atenção
- Demonstrar empatia genuína
- Propor solução concreta
- Escalar para humano se necessário

[REGRAS]
- Nunca discuta com o cliente
- Peça desculpas quando cabível (sem admitir culpa indevidamente)
- Ofereça compensação quando autorizado
- Se o problema não puder ser resolvido, encaminhe para atendente humano
- Documente a reclamação para melhoria contínua

[FASE ATUAL: {{currentPhase}}]
{{phaseInstructions}}

[FORMATO]
Responda em JSON válido conforme o schema fornecido.`,
  tools: [
    {
      name: 'trigger_automation',
      description: 'Dispara automação (ex: abrir ticket, escalar, compensar)',
      schema: TriggerAutomationToolSchema,
    },
  ],
  responseSchema: BaseAgentResponseSchema,
  phases: SUPPORT_PHASES,
  defaultPhase: 'GREETING',
};
