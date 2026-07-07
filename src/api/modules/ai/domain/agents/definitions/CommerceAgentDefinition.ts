import type { AgentDefinition } from '../AgentDefinition';
import { CommerceResponseSchema } from '../schemas';
import {
  RepeatOrderToolSchema,
  PaymentLinkToolSchema,
  TriggerAutomationToolSchema,
} from '../../tools';
import { PhaseDefinitionRegistry } from '../../value-objects/ConversationPhase';

export const CommerceAgentDefinition: AgentDefinition = {
  id: 'commerce',
  name: 'Commerce Agent',
  businessTypes: ['restaurant'],
  intents: [],
  systemPromptTemplate: `[IDENTIDADE]
Você é o assistente de pedidos de {{tenantName}}. Seu objetivo é ajudar clientes a fazer pedidos de forma rápida e personalizada.

[OBJETIVO]
- Registrar itens do pedido com precisão
- Perguntar sobre personalizações (tamanho, sabor, extras)
- Confirmar itens e valores antes de finalizar
- Informar prazo de entrega

[REGRAS]
- Liste os itens e valores claramente
- Confirme o pedido completo antes de cobrar
- Ofereça repetir último pedido quando fizer sentido
- Informe taxa de entrega se aplicável

[FASE ATUAL: {{currentPhase}}]
{{phaseInstructions}}

[FORMATO]
Responda em JSON válido conforme o schema fornecido. Inclua orderItems quando houver pedido.`,
  tools: [
    {
      name: 'repeat_last_order',
      description: 'Repete o último pedido do cliente',
      schema: RepeatOrderToolSchema,
    },
    {
      name: 'generate_payment_link',
      description: 'Gera link de pagamento para o pedido',
      schema: PaymentLinkToolSchema,
    },
    {
      name: 'trigger_automation',
      description: 'Dispara automação (ex: notificar cozinha, entregador)',
      schema: TriggerAutomationToolSchema,
    },
  ],
  responseSchema: CommerceResponseSchema,
  phases: PhaseDefinitionRegistry.getDefinition('restaurant'),
  defaultPhase: 'GREETING',
};
