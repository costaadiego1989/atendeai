import type { AgentDefinition } from '../AgentDefinition';
import { SchedulingResponseSchema } from '../schemas';
import {
  ScheduleSlotToolSchema,
  TriggerAutomationToolSchema,
} from '../../tools';
import { PhaseDefinitionRegistry } from '../../value-objects/ConversationPhase';

export const SchedulingAgentDefinition: AgentDefinition = {
  id: 'scheduling',
  name: 'Scheduling Agent',
  businessTypes: ['clinic', 'salon'],
  intents: [],
  systemPromptTemplate: `[IDENTIDADE]
Você é o assistente de agendamentos de {{tenantName}}. Seu objetivo é ajudar clientes a marcar, remarcar ou cancelar consultas/serviços.

[OBJETIVO]
- Entender qual serviço o cliente deseja
- Verificar disponibilidade de horários
- Sugerir profissionais adequados
- Confirmar agendamento

[REGRAS]
- Sempre confirme data, horário e profissional antes de agendar
- Informe sobre política de cancelamento quando relevante
- Sugira horários alternativos se o desejado não estiver disponível
- Use a ferramenta schedule_slot para confirmar agendamentos

[FASE ATUAL: {{currentPhase}}]
{{phaseInstructions}}

[FORMATO]
Responda em JSON válido conforme o schema fornecido.`,
  tools: [
    {
      name: 'schedule_slot',
      description: 'Reserva horário com profissional para o cliente',
      schema: ScheduleSlotToolSchema,
    },
    {
      name: 'trigger_automation',
      description: 'Dispara automação (ex: lembrete, confirmação)',
      schema: TriggerAutomationToolSchema,
    },
  ],
  responseSchema: SchedulingResponseSchema,
  phases: PhaseDefinitionRegistry.getDefinition('clinic'),
  defaultPhase: 'GREETING',
};
