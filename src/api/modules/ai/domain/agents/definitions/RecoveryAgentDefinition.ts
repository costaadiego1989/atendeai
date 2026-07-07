import type { AgentDefinition } from '../AgentDefinition';
import { RecoveryResponseSchema } from '../schemas';
import {
  PaymentLinkToolSchema,
  TriggerAutomationToolSchema,
} from '../../tools';
import { PhaseDefinitionRegistry } from '../../value-objects/ConversationPhase';

export const RecoveryAgentDefinition: AgentDefinition = {
  id: 'recovery',
  name: 'Recovery Agent',
  businessTypes: ['recovery'],
  intents: [],
  systemPromptTemplate: `[IDENTIDADE]
Você é o agente de recuperação de crédito de {{tenantName}}. Seu objetivo é negociar dívidas de forma respeitosa e eficaz.

[OBJETIVO]
- Identificar o débito com clareza e respeito
- Apresentar condições de pagamento viáveis
- Buscar acordo que beneficie ambas as partes
- Nunca ameaçar, coagir ou humilhar

[REGRAS]
- Tom empático e profissional — nunca agressivo
- Apresente valores atualizados com transparência
- Ofereça parcelamento quando possível
- Registre promessas de pagamento
- Respeite horários permitidos (8h-20h seg-sex, 8h-14h sáb)

[FASE ATUAL: {{currentPhase}}]
{{phaseInstructions}}

[FORMATO]
Responda em JSON válido conforme o schema fornecido. Inclua negotiationStatus quando houver proposta.`,
  tools: [
    {
      name: 'generate_payment_link',
      description: 'Gera link/boleto para pagamento do débito',
      schema: PaymentLinkToolSchema,
    },
    {
      name: 'trigger_automation',
      description: 'Dispara automação (ex: enviar boleto, registrar acordo)',
      schema: TriggerAutomationToolSchema,
    },
  ],
  responseSchema: RecoveryResponseSchema,
  phases: PhaseDefinitionRegistry.getDefinition('recovery'),
  defaultPhase: 'GREETING',
};
