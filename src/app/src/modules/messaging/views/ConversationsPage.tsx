import { useEffect, useRef } from 'react';
import { usePageTitle } from '@/shared/lib/usePageTitle';
import { ModuleAgentRuleButton } from '@/modules/agent-rules/components/ModuleAgentRuleButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useConversationsPageViewModel } from '@/modules/messaging/view-models/useConversationsPageViewModel';
import {
  Bot,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquareText,
  Mic,
  Paperclip,
  Phone,
  RefreshCcw,
  Search,
  SendHorizonal,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { MessagingKPIs } from '../components/MessagingKPIs';
import { MessageBubble } from '../components/MessageBubble';
import { ConversationListItem } from '../components/ConversationListItem';
import { SaleAttributionDialog } from '../components/SaleAttributionDialog';
import { ConversationChargeDialog } from '../components/ConversationChargeDialog';
import { ConversationContextPanel } from '../components/ConversationContextPanel';
import {
  formatConversationPhone,
  isProspectConversation,
} from '../utils/conversation-ui-helpers';
import {
  getSaleAttributionDialogCopy,
  getSaleAttributionMeta,
} from '@/modules/messaging/utils/sale-attribution-ui';
import { Megaphone } from 'lucide-react';

export default function ConversationsPage() {
  usePageTitle('Conversas');
  const vm = useConversationsPageViewModel();
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
      messagesEndRef.current?.scrollIntoView({ block: 'end', behavior });
    };

    const frame = window.requestAnimationFrame(() => scrollToBottom('auto'));
    const mediaLayoutTimeout = window.setTimeout(() => scrollToBottom('smooth'), 120);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(mediaLayoutTimeout);
    };
  }, [lastMessageKey, vm.messages.length, vm.messagesQuery.isLoading, vm.selectedConversation?.id]);

  function getAttachmentIcon() {
    const type = vm.selectedAttachment?.type ?? '';
    if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (type.startsWith('audio/')) return <Mic className="h-4 w-4" />;
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
        <ModuleAgentRuleButton moduleId="messaging" buttonSize="sm" />
      </div>

      <MessagingKPIs stats={vm.queueStats} />

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
                    vm.setQueueFilter(filter.id as 'ALL' | 'NEW' | 'MINE' | 'WAITING_CUSTOMER')
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
      </div>

      <div className="flex h-[calc(100vh-10rem)] min-h-[680px] gap-4">
        <section className="flex w-[340px] min-w-[340px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
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
              <div className="space-y-3">
                {vm.conversations.map((conversation) => (
                  <ConversationListItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={vm.selectedConversation?.id === conversation.id}
                    currentUserId={vm.currentUserId}
                    onSelect={vm.selectConversation}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 px-6 text-center">
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

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
          {vm.selectedConversation ? (
            <>
              <div className="border-b border-border/60 px-6 py-5">
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

                {vm.selectedSignal ? (
                  <div className="mt-4 rounded-[24px] border border-primary/15 bg-primary/5 px-5 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Bot className="h-4 w-4" />
                      {vm.selectedSignal.label}
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {vm.selectedSignal.detail}
                    </p>
                  </div>
                ) : null}
              </div>

              <div ref={messagesViewportRef} role="log" aria-live="polite" aria-label="Histórico de mensagens" className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 px-6 text-center">
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

              <div className="border-t border-border/60 px-6 py-4">
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
                        checked={vm.assistantAutopilotEnabled}
                        onCheckedChange={vm.setAssistantAutopilotEnabled}
                      />
                    </div>
                  </div>
                ) : null}
                {vm.selectedAttachment ? (
                  <div className="mb-3 flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      {getAttachmentIcon()}
                      <span className="truncate font-medium">{vm.selectedAttachment.name}</span>
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
                    onChange={vm.handleAttachmentChange}
                    disabled={vm.selectedConversation.status === 'ARCHIVED'}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-2xl"
                    disabled={
                      vm.selectedConversation.status === 'ARCHIVED' ||
                      vm.assistantAutopilotEnabled
                    }
                    onClick={() => document.getElementById('messaging-attachment-input')?.click()}
                    title="Anexar imagem, audio ou documento"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={vm.draftMessage}
                    onChange={(event) => vm.setDraftMessage(event.target.value)}
                    placeholder={
                      vm.assistantAutopilotEnabled
                        ? 'A IA vai responder usando o contexto da conversa.'
                        : 'Digite sua mensagem para o cliente...'
                    }
                    className="h-12 rounded-2xl"
                    disabled={
                      vm.selectedConversation.status === 'ARCHIVED' ||
                      vm.assistantAutopilotEnabled
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        if (
                          vm.assistantAutopilotEnabled &&
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
                  !vm.assistantAutopilotEnabled ? (
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
                      (!vm.assistantAutopilotEnabled &&
                        !vm.draftMessage.trim() &&
                        !vm.selectedAttachment)
                    }
                    onClick={() => {
                      if (
                        vm.assistantAutopilotEnabled &&
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
                    ) : vm.assistantAutopilotEnabled ? (
                      <Sparkles className="mr-2 h-4 w-4" />
                    ) : (
                      <SendHorizonal className="mr-2 h-4 w-4" />
                    )}
                    {vm.assistantAutopilotEnabled ? 'Responder com IA' : 'Enviar'}
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

        <ConversationContextPanel
          vm={vm}
          selectedSignal={vm.selectedSignal}
          saleDialogCopy={saleDialogCopy}
          onOpenSaleDialog={() => {
            vm.setSaleNotes('');
            vm.setSaleAmountDisplay('');
            vm.setSaleDialogOpen(true);
          }}
        />
      </div>

      <SaleAttributionDialog
        open={vm.saleDialogOpen}
        onOpenChange={vm.setSaleDialogOpen}
        saleNotes={vm.saleNotes}
        setSaleNotes={vm.setSaleNotes}
        saleAmountDisplay={vm.saleAmountDisplay}
        setSaleAmountDisplay={vm.setSaleAmountDisplay}
        saleDialogCopy={saleDialogCopy}
        markSaleAttributionMutation={vm.markSaleAttributionMutation}
        selectedConversation={vm.selectedConversation}
      />

      <ConversationChargeDialog
        open={vm.chargeDialogOpen}
        onOpenChange={vm.setChargeDialogOpen}
        chargeForm={vm.chargeForm}
        setChargeForm={vm.setChargeForm}
        formatConversationChargeValue={vm.formatConversationChargeValue}
        createConversationChargeMutation={vm.createConversationChargeMutation}
        submitConversationCharge={vm.submitConversationCharge}
      />
    </div>
  );
}
