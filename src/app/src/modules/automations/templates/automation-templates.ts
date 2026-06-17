import type { ComponentType } from 'react';
import { Clock, MessageSquare, ShoppingCart } from 'lucide-react';
import { TriggerType, StepType } from '../types';
import type { Automation, CreateAutomationInput } from '../types';

/**
 * A pre-configured automation blueprint. The catalog below is the single source
 * of truth consumed both by the wizard UI and by the AI/automated path via
 * {@link instantiateAutomationTemplate}.
 */
export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: ComponentType<{ className?: string }>;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  automation: Partial<Automation>;
}

export const automationTemplates: AutomationTemplate[] = [
  {
    id: 'welcome-sequence',
    name: 'Sequência de Boas-Vindas',
    description: 'Envie mensagens automáticas para novos contatos',
    category: 'Mensagens',
    icon: MessageSquare,
    difficulty: 'beginner',
    estimatedTime: '5 minutos',
    automation: {
      name: 'Sequência de boas-vindas',
      description: 'Mensagens de boas-vindas automatizadas para novos contatos',
      trigger: {
        type: TriggerType.CONTACT_CREATED,
        config: {},
      },
      steps: [
        {
          type: StepType.SEND_MESSAGE,
          config: { channel: 'whatsapp', body: 'Olá! Seja bem-vindo(a) ao AtendeAi! 😊' },
          order: 0,
        },
        {
          type: StepType.WAIT_DELAY,
          config: { delayHuman: '1h', delayMs: 3600000 },
          order: 1,
        },
        {
          type: StepType.SEND_MESSAGE,
          config: { channel: 'whatsapp', body: 'Gostaria de saber mais sobre nossos serviços?' },
          order: 2,
        },
      ],
    },
  },
  {
    id: 'payment-reminder',
    name: 'Lembrete de Pagamento',
    description: 'Notifique clientes sobre pagamentos vencidos',
    category: 'Financeiro',
    icon: Clock,
    difficulty: 'intermediate',
    estimatedTime: '10 minutos',
    automation: {
      name: 'Lembrete de pagamento vencido',
      description: 'Envia lembretes automáticos para pagamentos vencidos',
      trigger: {
        type: TriggerType.PAYMENT_OVERDUE,
        config: {},
      },
      steps: [
        {
          type: StepType.SEND_MESSAGE,
          config: { channel: 'whatsapp', body: 'Seu pagamento está vencido. Por favor, regularize sua situação.' },
          order: 0,
        },
        {
          type: StepType.ADD_TAG,
          config: { tag: 'payment_overdue' },
          order: 1,
        },
      ],
    },
  },
  {
    id: 'cart-abandonment',
    name: 'Recuperação de Carrinho',
    description: 'Reativa clientes que abandonaram o carrinho',
    category: 'E-commerce',
    icon: ShoppingCart,
    difficulty: 'advanced',
    estimatedTime: '15 minutos',
    automation: {
      name: 'Recuperação de carrinho abandonado',
      description: 'Mensagens automáticas para recuperar carrinhos abandonados',
      trigger: {
        type: TriggerType.CART_ABANDONED,
        config: { timeout: 30 },
      },
      steps: [
        {
          type: StepType.SEND_MESSAGE,
          config: { channel: 'whatsapp', body: 'Você deixou itens no carrinho! Volte e finalize sua compra.' },
          order: 0,
        },
        {
          type: StepType.WAIT_DELAY,
          config: { delayHuman: '24h', delayMs: 86400000 },
          order: 1,
        },
        {
          type: StepType.SEND_MESSAGE,
          config: { channel: 'whatsapp', body: 'Ainda interessado(a) nos produtos? Temos ofertas especiais!' },
          order: 2,
        },
      ],
    },
  },
];

export class UnknownAutomationTemplateError extends Error {
  constructor(id: string) {
    super(`Unknown automation template: ${id}`);
    this.name = 'UnknownAutomationTemplateError';
  }
}

/** All available templates. */
export function listAutomationTemplates(): AutomationTemplate[] {
  return automationTemplates;
}

/** Resolve a template by id or throw {@link UnknownAutomationTemplateError}. */
export function getAutomationTemplate(id: string): AutomationTemplate {
  const template = automationTemplates.find((t) => t.id === id);
  if (!template) {
    throw new UnknownAutomationTemplateError(id);
  }
  return template;
}

/**
 * Turn a template into a ready-to-create automation payload. Pure and
 * deterministic — safe for both the UI and an automated/AI caller. Configs are
 * deep-cloned so callers cannot mutate the shared catalog, and step `id`s are
 * stripped with `order` re-indexed.
 */
export function instantiateAutomationTemplate(id: string): CreateAutomationInput {
  const { automation, name, description } = getAutomationTemplate(id);

  const steps = (automation.steps ?? [])
    .filter((step) => step.type)
    .map((step, index) => ({
      type: step.type,
      config: structuredClone(step.config ?? {}),
      order: index,
    }));

  return {
    name: automation.name ?? name,
    description: automation.description ?? description,
    trigger: {
      type: automation.trigger?.type ?? TriggerType.MESSAGE_RECEIVED,
      config: structuredClone(automation.trigger?.config ?? {}),
    },
    steps,
  };
}
