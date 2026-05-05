import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileStack,
  MessageSquareHeart,
  Phone,
  SendHorizontal,
} from 'lucide-react';
import type { ContactTimelineEntry } from '@/shared/types';
import { recoveryStatusLabels } from '@/modules/recovery/components/RecoveryLabel';
import type { RecoveryPageViewModel } from '@/modules/recovery/view-models/useRecoveryPageViewModel';

type TimelineTone = {
  iconBgClassName: string;
  iconClassName: string;
};

export interface RecoveryTimelineVisualItem {
  id: string;
  title: string;
  timestamp?: string | null;
  description: string;
  icon: LucideIcon;
  tone: TimelineTone;
}

const defaultTone: TimelineTone = {
  iconBgClassName: 'bg-primary/10',
  iconClassName: 'text-primary',
};

const TIMELINE_KEY_LABELS: Record<string, string> = {
  CRM: 'CRM',
  MANUAL: 'Manual',
  IMPORT: 'Importado',
  WHATSAPP: 'WhatsApp',
  LEAD: 'Lead',
  PROSPECT: 'Prospect',
  OPPORTUNITY: 'Oportunidade',
  CUSTOMER: 'Cliente',
  NEW: 'Novo',
  QUALIFIED: 'Qualificado',
  WON: 'Ganho',
  LOST: 'Perdido',
  ACTIVE: 'Ativo',
  PAID: 'Pago',
};

function formatDetails(details: Record<string, unknown>) {
  const preferredKeys = [
    'messageText',
    'messagePreview',
    'customerMessage',
    'status',
    'fromStage',
    'toStage',
    'fromStatus',
    'toStatus',
    'scheduledFor',
    'paymentReference',
    'amount',
    'channel',
    'reason',
  ];

  const visibleValues = preferredKeys
    .map((key) => {
      const value = details[key];
      if (typeof value !== 'string') return value;

      const trimmedValue = value.trim();
      const upperValue = trimmedValue.toUpperCase();

      // Combine labels to try translation
      const combinedLabels: Record<string, string> = {
        ...recoveryStatusLabels,
        ...TIMELINE_KEY_LABELS,
      };

      if (combinedLabels[upperValue]) {
        return combinedLabels[upperValue];
      }

      // If it looks like a recovery|ID, don't show the full string if we already have a status
      if (trimmedValue.startsWith('recovery|') && trimmedValue.length > 20) {
        return null;
      }

      return trimmedValue;
    })
    .filter(
      (value): value is string | number =>
        (typeof value === 'string' || typeof value === 'number') && value !== '',
    )
    .map((value) => String(value))
    .filter(Boolean);

  if (visibleValues.length > 0) {
    return visibleValues.slice(0, 2).join(' • ');
  }

  return 'Evento operacional registrado no historico deste contato.';
}

export function mapContactTimelineEntryToVisual(
  entry: ContactTimelineEntry,
  index: number,
): RecoveryTimelineVisualItem {
  const config: Record<
    ContactTimelineEntry['type'],
    {
      icon: LucideIcon;
      tone: TimelineTone;
    }
  > = {
    CONTACT_CREATED: {
      icon: FileStack,
      tone: {
        iconBgClassName: 'bg-sky-500/10',
        iconClassName: 'text-sky-400',
      },
    },
    CONTACT_STAGE: {
      icon: CheckCircle2,
      tone: {
        iconBgClassName: 'bg-primary/10',
        iconClassName: 'text-primary',
      },
    },
    CONTACT_NOTE: {
      icon: FileStack,
      tone: defaultTone,
    },
    RECOVERY_CASE_CREATED: {
      icon: CircleDollarSign,
      tone: {
        iconBgClassName: 'bg-amber-500/10',
        iconClassName: 'text-amber-400',
      },
    },
    RECOVERY_STATUS: {
      icon: CircleDollarSign,
      tone: {
        iconBgClassName: 'bg-amber-500/10',
        iconClassName: 'text-amber-400',
      },
    },
    CONVERSATION_STARTED: {
      icon: Phone,
      tone: {
        iconBgClassName: 'bg-emerald-500/10',
        iconClassName: 'text-emerald-400',
      },
    },
    MESSAGE_INBOUND: {
      icon: MessageSquareHeart,
      tone: {
        iconBgClassName: 'bg-sky-500/10',
        iconClassName: 'text-sky-400',
      },
    },
    MESSAGE_OUTBOUND: {
      icon: SendHorizontal,
      tone: {
        iconBgClassName: 'bg-primary/10',
        iconClassName: 'text-primary',
      },
    },
    PAYMENT_CONFIRMED: {
      icon: CircleDollarSign,
      tone: {
        iconBgClassName: 'bg-emerald-500/10',
        iconClassName: 'text-emerald-400',
      },
    },
    PAYMENT_OVERDUE: {
      icon: CircleDollarSign,
      tone: {
        iconBgClassName: 'bg-rose-500/10',
        iconClassName: 'text-rose-400',
      },
    },
    PAYMENT_REFUNDED: {
      icon: CircleDollarSign,
      tone: {
        iconBgClassName: 'bg-slate-500/10',
        iconClassName: 'text-slate-300',
      },
    },
    SCHEDULING_RESERVED: {
      icon: CalendarClock,
      tone: {
        iconBgClassName: 'bg-violet-500/10',
        iconClassName: 'text-violet-300',
      },
    },
    FOLLOW_UP_SCHEDULED: {
      icon: CalendarClock,
      tone: defaultTone,
    },
    FOLLOW_UP_CANCELLED: {
      icon: CalendarClock,
      tone: {
        iconBgClassName: 'bg-rose-500/10',
        iconClassName: 'text-rose-400',
      },
    },
    FOLLOW_UP_TRIGGERED: {
      icon: Bot,
      tone: {
        iconBgClassName: 'bg-primary/10',
        iconClassName: 'text-primary',
      },
    },
    FOLLOW_UP_SKIPPED: {
      icon: Bot,
      tone: {
        iconBgClassName: 'bg-slate-500/10',
        iconClassName: 'text-slate-300',
      },
    },
    HANDOFF_HUMAN: {
      icon: MessageSquareHeart,
      tone: {
        iconBgClassName: 'bg-amber-500/10',
        iconClassName: 'text-amber-400',
      },
    },
  };

  const entryConfig = config[entry.type] ?? { icon: FileStack, tone: defaultTone };

  return {
    id: `${entry.type}-${entry.timestamp}-${index}`,
    title: entry.title,
    timestamp: entry.timestamp,
    description: formatDetails(entry.details),
    icon: entryConfig.icon,
    tone: entryConfig.tone,
  };
}

export function buildRecoveryFallbackMilestones(vm: RecoveryPageViewModel): RecoveryTimelineVisualItem[] {
  const item = vm.selectedCase;
  if (!item) {
    return [];
  }

  return [
    {
      id: 'created',
      title: 'Caso criado',
      timestamp: item.createdAt,
      description: 'Entrada registrada na carteira de Cobrança.',
      icon: FileStack,
      tone: defaultTone,
    },
    {
      id: 'last-contact',
      title: 'Ultimo contato',
      timestamp: item.açãoContactedAt,
      description: 'Momento da ultima mensagem registrada com o cliente.',
      icon: MessageSquareHeart,
      tone: {
        iconBgClassName: 'bg-sky-500/10',
        iconClassName: 'text-sky-400',
      },
    },
    {
      id: 'next-action',
      title: 'Proxima acao',
      timestamp: item.nextActionAt,
      description: 'Follow-up previsto para nova tentativa ou promessa.',
      icon: CalendarClock,
      tone: defaultTone,
    },
    {
      id: 'payment-link',
      title: 'Cobrança enviada',
      timestamp: item.paymentReference ? item.lastContactedAt || item.updatedAt : null,
      description: 'Link de pagamento gerado e enviado ao cliente.',
      icon: CircleDollarSign,
      tone: {
        iconBgClassName: 'bg-amber-500/10',
        iconClassName: 'text-amber-400',
      },
    },
    {
      id: 'guidance',
      title: 'Sugestao gerada',
      timestamp: item.guidanceGeneratedAt,
      description: 'sugestão de resposta criada para apoiar o atendente.',
      icon: Bot,
      tone: defaultTone,
    },
    {
      id: 'paid',
      title: 'Pagamento confirmado',
      timestamp: item.paidAt,
      description: 'Conciliacao financeira recebida via evento.',
      icon: CircleDollarSign,
      tone: {
        iconBgClassName: 'bg-emerald-500/10',
        iconClassName: 'text-emerald-400',
      },
    },
  ].filter((milestone) => Boolean(milestone.timestamp));
}
