import { formatDateTime, formatTime } from '@/shared/lib/formatters';
import { formatPhone } from '@/shared/lib/masks';
import type { Conversation } from '@/shared/types';

export const PROSPECT_TAGS = ['prospect', 'prospecting', 'prospecção', 'campanha', 'campaign'];

export const QUICK_ACTION_BUTTON_CLASS_NAME =
  'h-11 justify-start rounded-2xl border border-border/70 bg-background/55 px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/20 hover:bg-muted/55 hover:text-foreground';

export function isProspectConversation(conversation: Conversation): boolean {
  if (conversation.origin === 'PROSPECTING') return true;
  const tags = conversation.intelligence?.tags ?? [];
  return tags.some((tag) => PROSPECT_TAGS.includes(tag.toLowerCase()));
}

export function formatConversationPhone(value?: string | null) {
  if (!value) {
    return 'Não informado';
  }

  return formatPhone(value.replace(/^55(?=\d{10,11}$)/, ''));
}

export function formatConversationClock(value?: string | null) {
  const formatted = formatTime(value ?? undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return formatted ?? '--:--';
}

export function formatConversationMoment(value?: string | null) {
  const formatted = formatDateTime(value ?? undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return formatted ?? 'Sem registro recente';
}

export function parseSaleAmountInput(value: string): number | undefined {
  const normalized = Number(
    value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''),
  );
  if (!Number.isFinite(normalized) || normalized < 0) {
    return undefined;
  }
  return normalized;
}

export function formatSaleAmountTyping(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  const amount = Number(digits) / 100;
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function getQueueSignal(
  conversation: Conversation,
  currentUserId: string | null,
) {
  if (conversation.status === 'ARCHIVED') {
    return {
      label: 'Encerrada',
      detail: 'Essa conversa foi finalizada e não aparece mais na fila ativa.',
      tone: 'muted' as const,
    };
  }

  if ((conversation.unreadCount ?? 0) > 0 && conversation.status === 'PENDING_HUMAN') {
    return {
      label: 'Sua vez',
      detail: 'O cliente respondeu e agora a conversa pede atuação do time.',
      tone: 'accent' as const,
    };
  }

  if ((conversation.unreadCount ?? 0) > 0) {
    return {
      label: 'Cliente respondeu',
      detail: 'Existe mensagem nova do cliente aguardando leitura.',
      tone: 'accent' as const,
    };
  }

  if (
    conversation.status === 'PENDING_HUMAN' &&
    conversation.assignedToUserId &&
    conversation.assignedToUserId === currentUserId
  ) {
    return {
      label: 'Em atendimento',
      detail: 'A conversa está assumida por você.',
      tone: 'human' as const,
    };
  }

  if (conversation.status === 'PENDING_HUMAN') {
    return {
      label: 'Com atendente',
      detail: `A conversa está com ${conversation.assignedToName ?? 'outro atendente'}.`,
      tone: 'human' as const,
    };
  }

  if (conversation.lastMessageDirection === 'OUTBOUND') {
    return {
      label: 'Aguardando cliente',
      detail: 'A última resposta saiu do sistema e agora o retorno depende do cliente.',
      tone: 'waiting' as const,
    };
  }

  return {
    label: 'IA respondendo',
    detail: 'A IA está respondendo. Você será notificado se precisar intervir.',
    tone: 'active' as const,
  };
}

export function getSentimentMeta(sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE') {
  if (sentiment === 'POSITIVE') {
    return {
      label: 'positivo',
      className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    };
  }

  if (sentiment === 'NEGATIVE') {
    return {
      label: 'atenção',
      className: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
    };
  }

  return {
    label: 'neutro',
    className: 'border-border/70 bg-muted/30 text-muted-foreground',
  };
}

export function getHandoffGuide(
  conversation: Conversation,
  currentUserId: string | null,
) {
  if (conversation.status === 'ARCHIVED') {
    return {
      title: 'Conversa encerrada',
      detail: 'Use o historico apenas como referência antes de reabrir ou iniciar novo contato.',
      action: 'Reabrir somente se houver novo contexto do cliente.',
    };
  }

  if (conversation.status === 'PENDING_HUMAN') {
    const owner =
      conversation.assignedToUserId && conversation.assignedToUserId === currentUserId
        ? 'você'
        : conversation.assignedToName ?? 'o time';

    return {
      title: 'Atendimento humano em andamento',
      detail: `A IA deve ficar em apoio enquanto ${owner} conduz a conversa.`,
      action:
        conversation.intelligence?.nextStep ??
        'Leia o resumo, responda de forma objetiva e defina o próximo passo.',
    };
  }

  if (conversation.intelligence?.sentiment === 'NEGATIVE') {
    return {
      title: 'Assumir com prioridade',
      detail: 'Ha sinal de objeção, cancelamento ou insatisfação nesta conversa.',
      action:
        conversation.intelligence.nextStep ??
        'Reconheca o problema, evite resposta automatica e encaminhe para atendimento humano.',
    };
  }

  if ((conversation.unreadCount ?? 0) > 0) {
    return {
      title: 'Cliente respondeu',
      detail: 'Existe mensagem nova aguardando leitura e classificação operacional.',
      action:
        conversation.intelligence?.nextStep ??
        'Responder agora ou assumir se a mensagem exigir decisão humana.',
    };
  }

  return {
    title: 'IA pode conduzir',
    detail: 'A conversa está dentro do fluxo automático e sem sinal crítico no momento.',
    action:
      conversation.intelligence?.nextStep ??
      'Acompanhe o retorno do cliente e assuma apenas se aparecer objeção ou pedido sensível.',
  };
}

export function getSignalClassName(tone: 'active' | 'accent' | 'human' | 'waiting' | 'muted') {
  switch (tone) {
    case 'accent':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'human':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'waiting':
      return 'border-slate-200 bg-slate-50 text-slate-700';
    case 'muted':
      return 'border-border bg-muted/60 text-muted-foreground';
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
}

export function getCheckoutStageLabel(step?: string | null) {
  switch (step) {
    case 'IDENTIFYING_NEED':
      return 'Descoberta';
    case 'SELECTING_ITEM':
      return 'Escolha do item';
    case 'AWAITING_QUANTITY':
      return 'Quantidade';
    case 'ASKING_MORE_ITEMS':
      return 'Mais itens';
    case 'AWAITING_FULFILLMENT':
      return 'Entrega ou retirada';
    case 'AWAITING_DELIVERY_ADDRESS':
      return 'Endereço';
    case 'AWAITING_FREIGHT_REVIEW':
      return 'Frete';
    case 'AWAITING_ORDER_NOTE':
      return 'Observação';
    case 'READY_FOR_CHECKOUT':
      return 'Pronto para cobrar';
    case 'AWAITING_PAYMENT':
      return 'Pagamento';
    case 'PAID':
      return 'Pago';
    case 'CANCELLED':
      return 'Cancelado';
    default:
      return 'Em andamento';
  }
}

export function getCheckoutStageOrder(step?: string | null) {
  switch (step) {
    case 'IDENTIFYING_NEED':
    case 'SELECTING_ITEM':
    case 'AWAITING_QUANTITY':
    case 'ASKING_MORE_ITEMS':
      return 1;
    case 'AWAITING_FULFILLMENT':
    case 'AWAITING_DELIVERY_ADDRESS':
    case 'AWAITING_FREIGHT_REVIEW':
      return 2;
    case 'AWAITING_ORDER_NOTE':
      return 3;
    case 'READY_FOR_CHECKOUT':
    case 'AWAITING_PAYMENT':
      return 4;
    case 'PAID':
      return 5;
    default:
      return 1;
  }
}

export function getAbandonmentLabel(interval?: string | null) {
  switch (interval) {
    case '1h':
      return 'Primeira retomada';
    case '1d':
      return 'Retomada de 1 dia';
    case '7d':
      return 'Retomada de 7 dias';
    default:
      return 'Retomada comercial';
  }
}
