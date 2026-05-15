import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ModuleAgentRuleButton } from '@/modules/agent-rules/components/ModuleAgentRuleButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useConversationsPageViewModel } from '@/modules/messaging/view-models/useConversationsPageViewModel';
import { formatCurrency, formatDateTime, formatTime } from '@/shared/lib/formatters';
import { formatPhone } from '@/shared/lib/masks';
import {
  Archive,
  Bot,
  CreditCard,
  Loader2,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Mic,
  Paperclip,
  Phone,
  RefreshCcw,
  Search,
  SendHorizonal,
  X,
  UserRound,
  Sparkles,
  GitBranch,
  FileText,
  Image as ImageIcon,
  ShoppingBag,
} from 'lucide-react';
import { MessagingKPIs } from '../components/MessagingKPIs';
import type { Conversation } from '@/shared/types';
import {
  getSaleAttributionDialogCopy,
  getSaleAttributionMeta,
} from '@/modules/messaging/utils/sale-attribution-ui';

const PROSPECT_TAGS = ['prospect', 'prospecting', 'prospecção', 'campanha', 'campaign'];
const QUICK_ACTION_BUTTON_CLASS_NAME =
  'h-11 justify-start rounded-2xl border border-border/70 bg-background/55 px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/20 hover:bg-muted/55 hover:text-foreground';

function isProspectConversation(conversation: Conversation): boolean {
  if (conversation.origin === 'PROSPECTING') return true;
  const tags = conversation.intelligence?.tags ?? [];
  return tags.some((tag) => PROSPECT_TAGS.includes(tag.toLowerCase()));
}

function formatConversationPhone(value?: string | null) {
  if (!value) {
    return 'Não informado';
  }

  return formatPhone(value.replace(/^55(?=\d{10,11}$)/, ''));
}

function formatConversationClock(value?: string | null) {
  const formatted = formatTime(value ?? undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return formatted ?? '--:--';
}

function formatConversationMoment(value?: string | null) {
  const formatted = formatDateTime(value ?? undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return formatted ?? 'Sem registro recente';
}

function parseSaleAmountInput(value: string): number | undefined {
  const normalized = Number(
    value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''),
  );
  if (!Number.isFinite(normalized) || normalized < 0) {
    return undefined;
  }
  return normalized;
}

function formatSaleAmountTyping(value: string): string {
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

function getQueueSignal(conversation: ReturnType<typeof useConversationsPageViewModel>['conversations'][number], currentUserId: string | null) {
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

function getSentimentMeta(sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE') {
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

function getHandoffGuide(
  conversation: ReturnType<typeof useConversationsPageViewModel>['conversations'][number],
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

function getSignalClassName(tone: 'active' | 'accent' | 'human' | 'waiting' | 'muted') {
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

function getCheckoutStageLabel(step?: string | null) {
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

function getCheckoutStageOrder(step?: string | null) {
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

function getAbandonmentLabel(interval?: string | null) {
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

function MessageBubble({
  direction,
  sender,
  content,
  timestamp,
  status,
  mediaUrl,
  mediaType,
}: {
  direction: 'INBOUND' | 'OUTBOUND';
  sender: 'CONTACT' | 'AGENT' | 'AI';
  content: string;
  timestamp: string;
  status?: string;
  mediaUrl?: string;
  mediaType?: string;
}) {
  const isOutbound = direction === 'OUTBOUND';
  const normalizedMediaType = mediaType?.toUpperCase();

  return (
    <div className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[82%] rounded-3xl px-4 py-3 shadow-sm',
          isOutbound
            ? 'bg-primary text-primary-foreground'
            : 'border border-border/70 bg-background text-foreground',
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] opacity-80">
          {sender === 'AI' ? (
            <>
              <Bot className="h-3.5 w-3.5" />
              Agente
            </>
          ) : sender === 'AGENT' ? (
            <>
              <UserRound className="h-3.5 w-3.5" />
              Time
            </>
          ) : (
            <>
              <MessageCircle className="h-3.5 w-3.5" />
              Cliente
            </>
          )}
        </div>
        {mediaUrl ? (
          <div className="mb-2 overflow-hidden rounded-2xl border border-border/50 bg-background/50">
            {normalizedMediaType === 'IMAGE' ? (
              <img
                src={mediaUrl}
                alt={content || 'Imagem enviada'}
                className="max-h-64 w-full object-cover"
              />
            ) : normalizedMediaType === 'AUDIO' ? (
              <div className="p-3">
                <audio controls src={mediaUrl} className="w-full" />
              </div>
            ) : (
              <a
                href={mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-3 text-sm font-medium underline-offset-4 hover:underline"
              >
                <FileText className="h-4 w-4" />
                Abrir documento
              </a>
            )}
          </div>
        ) : null}
        {content ? <p className="whitespace-pre-wrap text-sm leading-6">{content}</p> : null}
        <div
          className={cn(
            'mt-2 flex items-center justify-end gap-2 text-[11px]',
            isOutbound ? 'text-primary-foreground/75' : 'text-muted-foreground',
          )}
        >
          <span>{formatConversationClock(timestamp)}</span>
          {status ? <span className="uppercase">{status}</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  const vm = useConversationsPageViewModel();
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [saleNotes, setSaleNotes] = useState('');
  const [saleAmountDisplay, setSaleAmountDisplay] = useState('');
  const [assistantAutopilotEnabled, setAssistantAutopilotEnabled] = useState(false);
  const saleAttributionMeta = getSaleAttributionMeta({
    commercialKind: vm.saleAttribution?.commercialKind,
    commercialStatus: vm.saleAttribution?.commercialStatus,
    evidenceSource: vm.saleAttribution?.evidenceSource,
  });
  const saleDialogCopy = getSaleAttributionDialogCopy({
    commercialKind: vm.saleAttribution?.commercialKind,
    commercialStatus: vm.saleAttribution?.commercialStatus,
    evidenceSource: vm.saleAttribution?.evidenceSource,
  });

  useEffect(() => {
    if (vm.selectedConversation?.status !== 'PENDING_HUMAN') {
      setAssistantAutopilotEnabled(false);
    }
  }, [vm.selectedConversation?.id, vm.selectedConversation?.status]);

  const selectedSignal = useMemo(() => {
    if (!vm.selectedConversation) {
      return null;
    }

    return getQueueSignal(vm.selectedConversation, vm.currentUserId);
  }, [vm.currentUserId, vm.selectedConversation]);

  const queueStats = useMemo(() => {
    const items = vm.conversations;

    return {
      newItems: items.filter((conversation) => (conversation.unreadCount ?? 0) > 0).length,
      ownedItems: items.filter(
        (conversation) =>
          conversation.status === 'PENDING_HUMAN' &&
          conversation.assignedToUserId === vm.currentUserId,
      ).length,
      waitingItems: items.filter(
        (conversation) =>
          conversation.status === 'ACTIVE' &&
          conversation.lastMessageDirection === 'OUTBOUND' &&
          (conversation.unreadCount ?? 0) === 0,
      ).length,
    };
  }, [vm.conversations, vm.currentUserId]);

  const lastMessageKey = vm.messages.at(-1)
    ? `${vm.messages.at(-1)?.id}-${vm.messages.at(-1)?.timestamp}-${vm.messages.at(-1)?.mediaUrl ?? ''}`
    : 'empty';

  useEffect(() => {
    if (!vm.selectedConversation?.id || vm.messagesQuery.isLoading) {
      return;
    }

    const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
      const viewport = messagesViewportRef.current;

      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }

      messagesEndRef.current?.scrollIntoView({
        block: 'end',
        behavior,
      });
    };

    const frame = window.requestAnimationFrame(() => scrollToBottom('auto'));
    const mediaLayoutTimeout = window.setTimeout(() => scrollToBottom('smooth'), 120);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(mediaLayoutTimeout);
    };
  }, [
    lastMessageKey,
    vm.messages.length,
    vm.messagesQuery.isLoading,
    vm.selectedConversation?.id,
  ]);

  async function copySelectedPhone() {
    if (!vm.selectedConversation?.contactPhone) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        vm.selectedConversation.contactPhone.replace(/^55(?=\d{10,11}$)/, ''),
      );
      toast({
        title: 'Telefone copiado',
        description: 'O número do contato foi copiado para a área de transferência.',
      });
    } catch {
      toast({
        title: 'Falha ao copiar telefone',
        description: 'Não foi possível copiar o número agora.',
        variant: 'destructive',
      });
    }
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    vm.setSelectedAttachment(file);
    event.target.value = '';
  }

  function getAttachmentIcon() {
    const type = vm.selectedAttachment?.type ?? '';

    if (type.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    if (type.startsWith('audio/')) {
      return <Mic className="h-4 w-4" />;
    }

    return <FileText className="h-4 w-4" />;
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">Conversas</h1>
          <p className="page-description">
            Acompanhe a fila operacional, assuma atendimentos e avance cada conversa para o
            próximo passo.
          </p>
        </div>
        <ModuleAgentRuleButton
          moduleId="messaging"
          buttonSize="sm"
        />
      </div>

      <MessagingKPIs stats={queueStats} />

      <div className="glass-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={vm.search}
              onChange={(event) => vm.setSearch(event.target.value)}
              placeholder="Buscar conversa, telefone ou mensagem"
              className="pl-9"
            />
          </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-1">
            {[
              { id: 'ALL', label: 'Todas' },
              { id: 'NEW', label: 'Novas' },
              { id: 'MINE', label: 'Minhas' },
              { id: 'WAITING_CUSTOMER', label: 'Aguardando cliente' },
            ].map((filter) => (
              <Button
                key={filter.id}
                type="button"
                variant={vm.queueFilter === filter.id ? 'secondary' : 'ghost'}
                className={cn(
                  'h-8 rounded-lg px-3 text-xs font-medium transition-all',
                  vm.queueFilter === filter.id
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:bg-background/50',
                )}
                onClick={() =>
                  vm.setQueueFilter(
                    filter.id as 'ALL' | 'NEW' | 'MINE' | 'WAITING_CUSTOMER',
                  )
                }
              >
                {filter.label}
              </Button>
            ))}
          </div>

          <div className="h-8 w-[1px] bg-border/40 hidden lg:block" />

          <div className="flex items-center gap-3">
            <Select
              value={vm.statusFilter}
              onValueChange={(value) =>
                vm.setStatusFilter(
                  value as 'ACTIVE' | 'PENDING_HUMAN' | 'ARCHIVED' | 'ALL' | 'OPEN',
                )
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="OPEN">Em aberto</SelectItem>
                <SelectItem value="ACTIVE">Chat por IA</SelectItem>
                <SelectItem value="PENDING_HUMAN">Atendimento humano</SelectItem>
                <SelectItem value="ARCHIVED">Encerradas</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={vm.channelFilter}
              onValueChange={(value) =>
                vm.setChannelFilter(value as 'ALL' | 'WHATSAPP' | 'INSTAGRAM')
              }
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos canais</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-10rem)] min-h-[680px] gap-4">
        <section className="flex w-[340px] min-w-[340px] flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              Fila de conversas
            </h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
              {vm.conversations.length}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {vm.conversationsQuery.isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando conversas...
              </div>
            ) : vm.conversations.length ? (
              <div className="space-y-2.5">
                {vm.conversations.map((conversation) => {
                  const isSelected = vm.selectedConversation?.id === conversation.id;
                  const signal = getQueueSignal(conversation, vm.currentUserId);
                  const interactionAt =
                    conversation.lastMessageAt ??
                    conversation.updatedAt ??
                    conversation.createdAt;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => vm.selectConversation(conversation.id)}
                      className={cn(
                        'block w-full rounded-[24px] border text-left transition-all',
                        isSelected
                          ? 'border-primary/30 bg-primary/5 shadow-sm'
                          : 'border-border/70 bg-background hover:border-primary/20 hover:bg-muted/20',
                      )}
                    >
                      <div className="flex items-start gap-3 px-3 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {conversation.contactName.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-semibold text-foreground">
                                {conversation.contactName}
                              </p>
                              {isProspectConversation(conversation) ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                                  <Megaphone className="h-3 w-3" />
                                  Prospect
                                </span>
                              ) : null}
                              <p className="truncate text-xs text-muted-foreground">
                                {formatConversationPhone(conversation.contactPhone)}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs font-medium text-muted-foreground">
                                {formatConversationClock(interactionAt)}
                              </p>
                              {(conversation.unreadCount ?? 0) > 0 ? (
                                <span className="mt-1 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                                  {conversation.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                            {conversation.intelligence?.summary ||
                              conversation.lastMessage ||
                              'Conversa sem mensagens ainda'}
                          </p>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                                {conversation.channel ?? 'WHATSAPP'}
                              </span>
                              <span
                                className={cn(
                                  'inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-medium',
                                  getSignalClassName(signal.tone),
                                )}
                              >
                                {signal.label}
                              </span>
                              {conversation.intelligence ? (
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
                                    getSentimentMeta(conversation.intelligence.sentiment).className,
                                  )}
                                >
                                  {getSentimentMeta(conversation.intelligence.sentiment).label}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-[28px] border border-dashed border-border/70 px-6 text-center">
                <MessageSquareText className="h-10 w-10 text-muted-foreground" />
                <h2 className="mt-4 text-lg font-semibold text-foreground">
                  Nenhuma conversa encontrada
                </h2>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                  Ajuste os filtros da fila ou aguarde novas mensagens entrarem na operação.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card">
          {vm.selectedConversation ? (
            <>
              <div className="border-b border-border/70 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                        {vm.selectedConversation.contactName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-[1.6rem] font-semibold tracking-tight text-foreground">
                          {vm.selectedConversation.contactName}
                        </h2>
                        {isProspectConversation(vm.selectedConversation) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/25 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
                            <Megaphone className="h-3.5 w-3.5" />
                            Prospect
                          </span>
                        ) : null}
                        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {formatConversationPhone(vm.selectedConversation.contactPhone)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
                    {vm.supportsManualSaleAttribution &&
                    vm.saleAttribution?.aiValidationStatus === 'APPROVED' ? (
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
                        saleAttributionMeta.accentClassName,
                      )}>
                        <ShoppingBag className="h-3.5 w-3.5" />
                        {saleAttributionMeta.badgeLabel}
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-2xl px-4"
                      onClick={() => void vm.messagesQuery.refetch()}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Atualizar
                    </Button>
                  </div>
                </div>

                {selectedSignal ? (
                  <div className="mt-4 rounded-[24px] border border-primary/15 bg-primary/5 px-5 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Bot className="h-4 w-4" />
                      {selectedSignal.label}
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {selectedSignal.detail}
                    </p>
                  </div>
                ) : null}
              </div>

              <div
                ref={messagesViewportRef}
                className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
              >
                {vm.messagesQuery.isLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando histórico...
                  </div>
                ) : vm.messages.length ? (
                  <div className="space-y-3">
                    {vm.messages.map((message) => (
                      <MessageBubble key={message.id} {...message} />
                    ))}
                    <div ref={messagesEndRef} className="h-px" />
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-[28px] border border-dashed border-border/70 px-6 text-center">
                    <MessageSquareText className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-2xl font-semibold text-foreground">
                      Sem mensagens ainda
                    </h3>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                      Assim que a conversa tiver histórico, ele aparecerá aqui para o time acompanhar.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-border/70 px-6 py-4">
                {vm.selectedConversation.status === 'PENDING_HUMAN' ? (
                  <div className="mb-3 rounded-2xl border border-primary/15 bg-primary/5 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          Assistente IA no atendimento
                        </p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Ative para a IA gerar e enviar a resposta automaticamente com base na última interação do cliente.
                        </p>
                      </div>
                      <Switch
                        checked={assistantAutopilotEnabled}
                        onCheckedChange={setAssistantAutopilotEnabled}
                      />
                    </div>
                  </div>
                ) : null}
                {vm.selectedAttachment ? (
                  <div className="mb-3 flex items-center justify-between rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      {getAttachmentIcon()}
                      <span className="truncate font-medium">
                        {vm.selectedAttachment.name}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl"
                      onClick={vm.clearSelectedAttachment}
                      title="Remover anexo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
                <div className="flex items-end gap-3">
                  <input
                    id="messaging-attachment-input"
                    type="file"
                    className="hidden"
                    accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={handleAttachmentChange}
                    disabled={vm.selectedConversation.status === 'ARCHIVED'}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-2xl"
                    disabled={
                      vm.selectedConversation.status === 'ARCHIVED' ||
                      assistantAutopilotEnabled
                    }
                    onClick={() =>
                      document.getElementById('messaging-attachment-input')?.click()
                    }
                    title="Anexar imagem, audio ou documento"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={vm.draftMessage}
                    onChange={(event) => vm.setDraftMessage(event.target.value)}
                    placeholder={
                      assistantAutopilotEnabled
                        ? 'A IA vai responder usando o contexto da conversa.'
                        : 'Digite sua mensagem para o cliente...'
                    }
                    className="h-12 rounded-2xl"
                    disabled={
                      vm.selectedConversation.status === 'ARCHIVED' ||
                      assistantAutopilotEnabled
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        if (
                          assistantAutopilotEnabled &&
                          vm.selectedConversation?.status === 'PENDING_HUMAN'
                        ) {
                          vm.sendAssistantReplyMutation.mutate();
                          return;
                        }

                        vm.sendMessage();
                      }
                    }}
                  />
                  {vm.selectedConversation.status === 'PENDING_HUMAN' &&
                  !assistantAutopilotEnabled ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-12 rounded-2xl px-4 text-primary bg-primary/10 hover:bg-primary/20"
                      disabled={vm.suggestReplyMutation.isPending}
                      onClick={() => vm.suggestReplyMutation.mutate()}
                      title="Gerar resposta com IA"
                    >
                      {vm.suggestReplyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-primary" />
                      )}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    className="h-12 rounded-2xl px-6"
                    disabled={
                      vm.sendMessageMutation.isPending ||
                      vm.sendAssistantReplyMutation.isPending ||
                      vm.selectedConversation.status === 'ARCHIVED' ||
                      (!assistantAutopilotEnabled &&
                        !vm.draftMessage.trim() &&
                        !vm.selectedAttachment)
                    }
                    onClick={() => {
                      if (
                        assistantAutopilotEnabled &&
                        vm.selectedConversation?.status === 'PENDING_HUMAN'
                      ) {
                        vm.sendAssistantReplyMutation.mutate();
                        return;
                      }

                      vm.sendMessage();
                    }}
                  >
                    {vm.sendMessageMutation.isPending ||
                    vm.sendAssistantReplyMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : assistantAutopilotEnabled ? (
                      <Sparkles className="mr-2 h-4 w-4" />
                    ) : (
                      <SendHorizonal className="mr-2 h-4 w-4" />
                    )}
                    {assistantAutopilotEnabled ? 'Responder com IA' : 'Enviar'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <MessageSquareText className="h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-2xl font-semibold text-foreground">Selecione uma conversa</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Escolha um item da fila para ver o histórico, responder o cliente e conduzir o atendimento.
              </p>
            </div>
          )}
        </section>

        <aside className="flex w-[320px] min-w-[320px] flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card">
          <div className="border-b border-border/70 px-5 py-5">
            <h2 className="text-[1.15rem] font-semibold text-foreground">Contexto e ações</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              O operador pode assumir, devolver ao fluxo ou agir rápido sem sair da conversa.
            </p>
          </div>

          {vm.selectedConversation ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Ações rápidas
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={QUICK_ACTION_BUTTON_CLASS_NAME}
                      onClick={() => vm.openSelectedContact()}
                    >
                      <UserRound className="mr-1.5 h-3.5 w-3.5" />
                      Ver contato
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={QUICK_ACTION_BUTTON_CLASS_NAME}
                      onClick={() => vm.openCheckout()}
                    >
                      <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                      Funil
                    </Button>
                    {vm.canCreateConversationCharge ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={QUICK_ACTION_BUTTON_CLASS_NAME}
                        onClick={() => vm.openPaymentLinks()}
                      >
                        <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                        Cobrar
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className={QUICK_ACTION_BUTTON_CLASS_NAME}
                      onClick={() => vm.updateConversationStatus('ACTIVE')}
                      disabled={vm.updateStatusMutation.isPending}
                    >
                      <Bot className="mr-1.5 h-3.5 w-3.5" />
                      Chat por IA
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={QUICK_ACTION_BUTTON_CLASS_NAME}
                      onClick={() => vm.updateConversationStatus('PENDING_HUMAN')}
                      disabled={vm.updateStatusMutation.isPending}
                    >
                      <UserRound className="mr-1.5 h-3.5 w-3.5" />
                        Atendente
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={QUICK_ACTION_BUTTON_CLASS_NAME}
                      onClick={() => vm.updateConversationStatus('ARCHIVED')}
                      disabled={vm.updateStatusMutation.isPending}
                    >
                      <Archive className="mr-1.5 h-3.5 w-3.5" />
                      Encerrar
                    </Button>
                    {vm.supportsManualSaleAttribution &&
                    vm.saleAttribution?.aiValidationStatus !== 'APPROVED' ? (
                      <Button
                        type="button"
                        className="col-span-2 mt-1 h-11 justify-start rounded-2xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                        disabled={
                          vm.markSaleAttributionMutation.isPending ||
                          vm.selectedConversation.status === 'ARCHIVED'
                        }
                        onClick={() => {
                          setSaleNotes('');
                          setSaleAmountDisplay('');
                          setSaleDialogOpen(true);
                        }}
                      >
                        <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                        {saleDialogCopy.title}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        inteligência da conversa
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {vm.selectedConversation.intelligence?.summary ??
                          'A inteligência aparece aqui após as primeiras mensagens relevantes.'}
                      </p>
                    </div>
                    {vm.selectedConversation.intelligence ? (
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                          getSentimentMeta(vm.selectedConversation.intelligence.sentiment).className,
                        )}
                      >
                        {getSentimentMeta(vm.selectedConversation.intelligence.sentiment).label}
                      </span>
                    ) : null}
                  </div>

                  {vm.selectedConversation.intelligence?.nextStep ? (
                    <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/5 p-3">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-primary">
                        Proximo passo
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground">
                        {vm.selectedConversation.intelligence.nextStep}
                      </p>
                    </div>
                  ) : null}

                  {vm.selectedConversation.intelligence?.tags?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {vm.selectedConversation.intelligence.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[24px] border border-sky-500/20 bg-sky-500/5 p-4">
                  {(() => {
                    const guide = getHandoffGuide(vm.selectedConversation, vm.currentUserId);

                    return (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
                          Resumo para o atendente
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {guide.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {guide.detail}
                        </p>
                        <div className="mt-3 rounded-2xl border border-sky-500/15 bg-background/50 p-3">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-sky-300">
                            Ação sugerida
                          </p>
                          <p className="mt-1 text-sm leading-6 text-foreground">
                            {guide.action}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {vm.selectedCheckoutOrder ? (
                  <div className="rounded-[24px] border border-border/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                          Etapas Checkout
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {getCheckoutStageLabel(
                            vm.selectedCheckoutSession?.currentStep ?? vm.selectedCheckoutOrder.status,
                          )}
                        </p>
                      </div>
                      <span className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        {vm.selectedCheckoutOrder.fulfillmentType === 'DELIVERY'
                          ? 'Entrega'
                          : 'Retirada'}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2">
                      {[
                        { index: 1, label: 'Carrinho' },
                        { index: 2, label: 'Entrega' },
                        { index: 3, label: 'Observação' },
                        { index: 4, label: 'cobrança' },
                        { index: 5, label: 'Pago' },
                      ].map((stage) => {
                        const currentOrder = getCheckoutStageOrder(
                          vm.selectedCheckoutSession?.currentStep ?? vm.selectedCheckoutOrder.status,
                        );
                        const state =
                          currentOrder === stage.index
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : currentOrder > stage.index
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-border/60 bg-background/60 text-muted-foreground';

                        return (
                          <div
                            key={stage.index}
                            className={`rounded-2xl border px-3 py-2 ${state}`}
                          >
                            <p className="text-[10px] uppercase tracking-[0.22em]">
                              Etapa {stage.index}
                            </p>
                            <p className="mt-1 text-sm font-medium">{stage.label}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          Total
                        </p>
                        <p className="mt-2 font-semibold text-foreground">
                          {formatCurrency(vm.selectedCheckoutOrder.totalAmount) ?? 'R$ 0,00'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          Pagamento
                        </p>
                        <p className="mt-2 font-semibold text-foreground">
                          {vm.selectedCheckoutOrder.paymentStatus === 'PAID' ? 'Pago' : 'Pendente'}
                        </p>
                      </div>
                    </div>

                    {vm.selectedCheckoutSession?.notes ? (
                      <div className="mt-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          Observação do pedido
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          {vm.selectedCheckoutSession.notes}
                        </p>
                      </div>
                    ) : null}

                    {(vm.selectedCheckoutOrder.abandonmentTouchesCount ?? 0) > 0 ? (
                      <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300">
                            Regua de abandono
                          </p>
                          <span className="rounded-full border border-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                            {vm.selectedCheckoutOrder.abandonmentTouchesCount} toque(s)
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {getAbandonmentLabel(
                            vm.selectedCheckoutOrder.lastAbandonmentInterval,
                          )}
                        </p>
                        {vm.selectedCheckoutOrder.lastAbandonmentAt ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Ultimo disparo em{' '}
                            {formatConversationMoment(
                              vm.selectedCheckoutOrder.lastAbandonmentAt,
                            )}
                          </p>
                        ) : null}

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-2xl border-amber-500/20 bg-background/50 px-3 text-xs"
                            disabled={
                              vm.updateCheckoutAbandonmentStateMutation.isPending ||
                              vm.triggerCheckoutAbandonmentTouchMutation.isPending
                            }
                            onClick={() =>
                              vm.updateCheckoutAbandonmentStateMutation.mutate(
                                !(vm.selectedCheckoutSession?.abandonmentPaused ?? false),
                              )
                            }
                          >
                            {vm.updateCheckoutAbandonmentStateMutation.isPending ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            {vm.selectedCheckoutSession?.abandonmentPaused
                              ? 'Retomar mensagem'
                              : 'Pausar mensagem'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-2xl border-amber-500/20 bg-background/50 px-3 text-xs"
                            disabled={
                              vm.updateCheckoutAbandonmentStateMutation.isPending ||
                              vm.triggerCheckoutAbandonmentTouchMutation.isPending
                            }
                            onClick={() => vm.triggerCheckoutAbandonmentTouchMutation.mutate()}
                          >
                            {vm.triggerCheckoutAbandonmentTouchMutation.isPending ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Reenviar agora
                          </Button>
                        </div>

                        {vm.selectedCheckoutSession?.abandonmentPaused ? (
                          <p className="mt-2 text-xs text-amber-200">
                            A mensagem automática está pausada para este checkout.
                          </p>
                        ) : null}

                        {vm.selectedCheckoutAbandonmentTouches.length ? (
                          <div className="mt-3 space-y-2">
                            {vm.selectedCheckoutAbandonmentTouches
                              .slice(0, 3)
                              .map((touch) => (
                                <div
                                  key={`${touch.interval}-${touch.triggeredAt}`}
                                  className="rounded-xl border border-amber-500/10 bg-background/40 p-2.5"
                                >
                                  <p className="text-xs font-medium text-foreground">
                                    {getAbandonmentLabel(touch.interval)}
                                  </p>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {formatConversationMoment(touch.triggeredAt)}
                                  </p>
                                </div>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Sinal da fila
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
                        selectedSignal ? getSignalClassName(selectedSignal.tone) : 'border-border',
                      )}
                    >
                      {selectedSignal?.label ?? 'Sem sinal'}
                    </span>
                    {(vm.selectedConversation.unreadCount ?? 0) > 0 ? (
                      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        {vm.selectedConversation.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {selectedSignal?.detail ?? 'Não há contexto adicional para esta conversa agora.'}
                  </p>
                </div>

                <div className="rounded-[24px] border border-border/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Contato
                  </p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Nome</p>
                      <p className="mt-1 font-medium text-foreground">
                        {vm.selectedConversation.contactName}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Telefone</p>
                      <p className="mt-1 font-medium text-foreground">
                        {formatConversationPhone(vm.selectedConversation.contactPhone)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Canal</p>
                      <p className="mt-1 font-medium text-foreground">
                        {vm.selectedConversation.channel ?? 'WHATSAPP'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Última interação</p>
                      <p className="mt-1 font-medium text-foreground">
                        {formatConversationMoment(
                          vm.selectedConversation.lastMessageAt ??
                          vm.selectedConversation.updatedAt ??
                          vm.selectedConversation.createdAt,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Responsável</p>
                      <p className="mt-1 font-medium text-foreground">
                        {vm.selectedConversation.assignedToName ?? 'IA / fila automática'}
                      </p>
                      {vm.selectedConversation.assignedAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Assumida em {formatConversationMoment(vm.selectedConversation.assignedAt)}
                        </p>
                      ) : null}
                    </div>
                    {vm.latestInboundMessage ? (
                      <div>
                        <p className="text-muted-foreground">Última mensagem do cliente</p>
                        <p className="mt-1 line-clamp-3 font-medium text-foreground">
                          {vm.latestInboundMessage.content}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm leading-6 text-muted-foreground">
              Selecione uma conversa para ver o contexto e as ações rápidas do atendimento.
            </div>
          )}
        </aside>
      </div>

      <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{saleDialogCopy.title}</DialogTitle>
            <DialogDescription>{saleDialogCopy.description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="sale-amount-input">Valor (opcional)</Label>
              <Input
                id="sale-amount-input"
                inputMode="decimal"
                value={saleAmountDisplay}
                onChange={(event) =>
                  setSaleAmountDisplay(formatSaleAmountTyping(event.target.value))
                }
                placeholder="R$ 0,00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sale-notes-input">Notas ou referência (opcional)</Label>
              <Textarea
                id="sale-notes-input"
                rows={3}
                value={saleNotes}
                onChange={(event) => setSaleNotes(event.target.value)}
                placeholder="Ex.: pedido #123, contrato, observações para auditoria."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                vm.markSaleAttributionMutation.isPending ||
                vm.selectedConversation?.status === 'ARCHIVED'
              }
              onClick={() => {
                if (!vm.selectedConversation) {
                  return;
                }
                const parsed = parseSaleAmountInput(saleAmountDisplay);
                vm.markSaleAttributionMutation.mutate(
                  {
                    ...(parsed !== undefined ? { saleAmount: parsed } : {}),
                    notes: saleNotes.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      setSaleDialogOpen(false);
                      setSaleNotes('');
                      setSaleAmountDisplay('');
                    },
                  },
                );
              }}
            >
              {vm.markSaleAttributionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="mr-2 h-4 w-4" />
              )}
              {saleDialogCopy.submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vm.chargeDialogOpen} onOpenChange={vm.setChargeDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Enviar cobranca</DialogTitle>
            <DialogDescription>
              Crie uma cobranca para a conversa atual e envie o link no WhatsApp do cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="conversation-charge-name">Titulo</Label>
              <Input
                id="conversation-charge-name"
                value={vm.chargeForm.name}
                onChange={(event) =>
                  vm.setChargeForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Ex: Mensalidade, consulta, servico recorrente"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="conversation-charge-value">Valor</Label>
                <Input
                  id="conversation-charge-value"
                  inputMode="decimal"
                  value={vm.chargeForm.value}
                  onChange={(event) => vm.formatConversationChargeValue(event.target.value)}
                  placeholder="R$ 120,00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conversation-charge-billing">Pagamento</Label>
                <Select
                  value={vm.chargeForm.billingType}
                  onValueChange={(value) =>
                    vm.setChargeForm((current) => ({
                      ...current,
                      billingType: value as typeof vm.chargeForm.billingType,
                    }))
                  }
                >
                  <SelectTrigger id="conversation-charge-billing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">Pix</SelectItem>
                    <SelectItem value="CREDIT_CARD">Cartao</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="conversation-charge-document">CPF/CNPJ</Label>
                <Input
                  id="conversation-charge-document"
                  value={vm.chargeForm.customerDocument}
                  onChange={(event) =>
                    vm.setChargeForm((current) => ({
                      ...current,
                      customerDocument: event.target.value,
                    }))
                  }
                  placeholder="Obrigatorio no primeiro pagamento"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conversation-charge-due">Vencimento</Label>
                <Input
                  id="conversation-charge-due"
                  type="date"
                  value={vm.chargeForm.dueDate}
                  onChange={(event) =>
                    vm.setChargeForm((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="conversation-charge-description">Descricao</Label>
              <Textarea
                id="conversation-charge-description"
                rows={3}
                value={vm.chargeForm.description}
                onChange={(event) =>
                  vm.setChargeForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Detalhe o servico, assinatura ou item vendido."
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <div>
                <Label htmlFor="conversation-charge-recurring">Recorrente</Label>
                <p className="text-xs text-muted-foreground">
                  Define frequência, inicio e fim para cobrancas recorrentes.
                </p>
              </div>
              <Switch
                id="conversation-charge-recurring"
                checked={vm.chargeForm.recurring}
                onCheckedChange={(checked) =>
                  vm.setChargeForm((current) => ({
                    ...current,
                    recurring: checked,
                    recurrenceStartDate: checked
                      ? current.recurrenceStartDate || current.dueDate
                      : '',
                    recurrenceEndDate: checked ? current.recurrenceEndDate : '',
                  }))
                }
              />
            </div>

            {vm.chargeForm.recurring ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Frequência</Label>
                  <Select
                    value={vm.chargeForm.recurrenceFrequency}
                    onValueChange={(value) =>
                      vm.setChargeForm((current) => ({
                        ...current,
                        recurrenceFrequency: value as typeof vm.chargeForm.recurrenceFrequency,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Semanal</SelectItem>
                      <SelectItem value="MONTHLY">Mensal</SelectItem>
                      <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                      <SelectItem value="YEARLY">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="conversation-charge-start">Inicio</Label>
                  <Input
                    id="conversation-charge-start"
                    type="date"
                    value={vm.chargeForm.recurrenceStartDate}
                    onChange={(event) =>
                      vm.setChargeForm((current) => ({
                        ...current,
                        recurrenceStartDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="conversation-charge-end">Fim</Label>
                  <Input
                    id="conversation-charge-end"
                    type="date"
                    value={vm.chargeForm.recurrenceEndDate}
                    onChange={(event) =>
                      vm.setChargeForm((current) => ({
                        ...current,
                        recurrenceEndDate: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => vm.setChargeDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={vm.createConversationChargeMutation.isPending}
              onClick={() => vm.submitConversationCharge()}
            >
              {vm.createConversationChargeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Criar e enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
