import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/shared/lib/formatters';
import {
  Archive,
  Bot,
  CreditCard,
  GitBranch,
  Loader2,
  Package,
  ShoppingBag,
  UserRound,
} from 'lucide-react';
import type { useConversationsPageViewModel } from '../view-models/useConversationsPageViewModel';
import type { getQueueSignal } from '../utils/conversation-ui-helpers';
import {
  formatConversationMoment,
  formatConversationPhone,
  getAbandonmentLabel,
  getCheckoutStageLabel,
  getCheckoutStageOrder,
  getHandoffGuide,
  getSentimentMeta,
  getSignalClassName,
  QUICK_ACTION_BUTTON_CLASS_NAME,
} from '../utils/conversation-ui-helpers';

type ConversationsPageViewModel = ReturnType<typeof useConversationsPageViewModel>;

interface ConversationContextPanelProps {
  vm: ConversationsPageViewModel;
  selectedSignal: ReturnType<typeof getQueueSignal> | null;
  saleDialogCopy: { title: string; description: string; submitLabel: string };
  onOpenSaleDialog: () => void;
}

export function ConversationContextPanel({
  vm,
  selectedSignal,
  saleDialogCopy,
  onOpenSaleDialog,
}: ConversationContextPanelProps) {
  return (
    <aside className="flex w-[320px] min-w-[320px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="border-b border-border/60 px-5 py-5">
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
                    onClick={onOpenSaleDialog}
                  >
                    <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                    {saleDialogCopy.title}
                  </Button>
                ) : null}
                {vm.selectedCheckoutOrder?.trackingCode ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={QUICK_ACTION_BUTTON_CLASS_NAME}
                    disabled={vm.sendTrackingToChatMutation.isPending}
                    onClick={() => vm.sendTrackingToChatMutation.mutate()}
                  >
                    {vm.sendTrackingToChatMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Package className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Enviar rastreio
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
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
                      className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
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
              <div className="rounded-2xl border border-border/60 p-4">
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
                  <span className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
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
                      vm.selectedCheckoutSession?.currentStep ?? vm.selectedCheckoutOrder!.status,
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

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
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

            <div className="rounded-2xl border border-border/60 p-4">
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
  );
}
