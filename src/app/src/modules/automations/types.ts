export enum TriggerType {
  CONTACT_CREATED = 'contact_created',
  TAG_ADDED = 'tag_added',
  MESSAGE_RECEIVED = 'message_received',
  PAYMENT_OVERDUE = 'payment_overdue',
  APPOINTMENT_CONFIRMED = 'appointment_confirmed',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  ORDER_PLACED = 'order_placed',
  CART_ABANDONED = 'cart_abandoned',
  WEBHOOK_RECEIVED = 'webhook_received',
  SCHEDULED = 'scheduled',
  MANUAL = 'manual',
}

export enum StepType {
  SEND_MESSAGE = 'send_message',
  WAIT_DELAY = 'wait_delay',
  CONDITION_BRANCH = 'condition_branch',
  HTTP_REQUEST = 'http_request',
  UPDATE_CONTACT = 'update_contact',
  ADD_TAG = 'add_tag',
  REMOVE_TAG = 'remove_tag',
  ASSIGN_AGENT = 'assign_agent',
  AI_RESPONSE = 'ai_response',
  CREATE_TASK = 'create_task',
}

export interface TriggerConfig {
  type: TriggerType;
  config: Record<string, unknown>;
}

export interface AutomationStep {
  id?: string;
  type: StepType;
  config: Record<string, unknown>;
  order: number;
}

export interface Automation {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  trigger: TriggerConfig;
  conditions: Record<string, unknown>[];
  steps: AutomationStep[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationInput {
  name: string;
  description?: string;
  trigger: TriggerConfig;
  conditions?: Record<string, unknown>[];
  steps: Omit<AutomationStep, 'id'>[];
}

export interface UpdateAutomationInput {
  name?: string;
  description?: string;
  trigger?: TriggerConfig;
  conditions?: Record<string, unknown>[];
  steps?: Omit<AutomationStep, 'id'>[];
  isActive?: boolean;
}

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  [TriggerType.CONTACT_CREATED]: 'Contato criado',
  [TriggerType.TAG_ADDED]: 'Tag adicionada',
  [TriggerType.MESSAGE_RECEIVED]: 'Mensagem recebida',
  [TriggerType.PAYMENT_OVERDUE]: 'Pagamento vencido',
  [TriggerType.APPOINTMENT_CONFIRMED]: 'Agendamento confirmado',
  [TriggerType.APPOINTMENT_REMINDER]: 'Lembrete de agendamento',
  [TriggerType.ORDER_PLACED]: 'Pedido realizado',
  [TriggerType.CART_ABANDONED]: 'Carrinho abandonado',
  [TriggerType.WEBHOOK_RECEIVED]: 'Webhook recebido',
  [TriggerType.SCHEDULED]: 'Agendado (cron)',
  [TriggerType.MANUAL]: 'Disparo manual / IA',
};

export const STEP_LABELS: Record<StepType, string> = {
  [StepType.SEND_MESSAGE]: 'Enviar mensagem',
  [StepType.WAIT_DELAY]: 'Aguardar',
  [StepType.CONDITION_BRANCH]: 'Condição (se/senão)',
  [StepType.HTTP_REQUEST]: 'Requisição HTTP',
  [StepType.UPDATE_CONTACT]: 'Atualizar contato',
  [StepType.ADD_TAG]: 'Adicionar tag',
  [StepType.REMOVE_TAG]: 'Remover tag',
  [StepType.ASSIGN_AGENT]: 'Atribuir agente',
  [StepType.AI_RESPONSE]: 'Resposta IA',
  [StepType.CREATE_TASK]: 'Criar tarefa',
};
