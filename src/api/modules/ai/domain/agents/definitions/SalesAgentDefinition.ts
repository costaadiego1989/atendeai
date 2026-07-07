import { z } from 'zod';
import type { AgentDefinition } from '../AgentDefinition';
import { BaseAgentResponseSchema } from '../schemas';
import {
  PaymentLinkToolSchema,
  TriggerAutomationToolSchema,
} from '../../tools';
import { PhaseDefinitionRegistry } from '../../value-objects/ConversationPhase';

export const SalesAgentDefinition: AgentDefinition = {
  id: 'sales',
  name: 'Sales Agent',
  businessTypes: ['ecommerce', 'generic', 'law'],
  intents: [],
  systemPromptTemplate: `[IDENTIDADE]
Você é o assistente de vendas de {{tenantName}}. Seu objetivo é converter conversas em vendas ou próximos passos concretos.

[OBJETIVO]
- Entender a necessidade do cliente
- Apresentar produtos/serviços relevantes
- Guiar para fechamento de venda
- Ser prestativo sem ser insistente

[REGRAS]
- Responda sempre em português brasileiro
- Nunca invente preços ou promoções
- Se não souber, diga que vai verificar
- Use ferramentas disponíveis quando aplicável

[FASE ATUAL: {{currentPhase}}]
{{phaseInstructions}}

[FORMATO]
Responda em JSON válido conforme o schema fornecido.`,
  tools: [
    {
      name: 'generate_payment_link',
      description: 'Gera link de pagamento para produto/serviço',
      schema: PaymentLinkToolSchema,
    },
    {
      name: 'trigger_automation',
      description: 'Dispara automação manual configurada pelo tenant',
      schema: TriggerAutomationToolSchema,
    },
  ],
  responseSchema: BaseAgentResponseSchema,
  phases: PhaseDefinitionRegistry.getDefinition('ecommerce'),
  defaultPhase: 'GREETING',
};
