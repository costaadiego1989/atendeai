import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, PauseCircle, PlayCircle, ShoppingCart } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/shared/lib/formatters';
import { formatPhone } from '@/shared/lib/masks';
import type { CommerceAbandonmentTouch } from '@/shared/types';

interface OrderDetail {
  id: string;
  status: string;
  paymentStatus?: string | null;
  paymentLinkUrl?: string | null;
  totalAmount: number;
  subtotalAmount: number;
  freightAmount: number;
  fulfillmentType?: string | null;
  shippingMode?: string | null;
  deliveryAddress?: string | null;
  updatedAt: string | Date;
}

interface SessionDetail {
  currentStep?: string | null;
  notes?: string | null;
  abandonmentPaused?: boolean;
  abandonmentPausedAt?: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

interface ListItemDetail {
  contactName?: string | null;
  contactPhone?: string | null;
}

interface CheckoutDetailsSheetProps {
  orderId: string | null;
  onClose: () => void;
  order: OrderDetail | null;
  session: SessionDetail | null;
  listItem: ListItemDetail | null;
  abandonmentTouches?: CommerceAbandonmentTouch[];
  onToggleAbandonmentPause?: (paused: boolean) => void;
  onTriggerManualTouch?: () => void;
  abandonmentBusy?: boolean;
  manualTouchBusy?: boolean;
  getOrderTone: (status: string) => string;
  getOrderLabel: (status: string) => string;
  getPaymentTone: (status?: string | null) => string;
  getPaymentLabel: (status?: string | null) => string;
  getCheckoutStageLabel: (step?: string | null) => string;
  getCheckoutStageOrder: (step?: string | null) => number;
}

export const CheckoutDetailsSheet: React.FC<CheckoutDetailsSheetProps> = ({
  orderId,
  onClose,
  order,
  session,
  listItem,
  abandonmentTouches,
  onToggleAbandonmentPause,
  onTriggerManualTouch,
  abandonmentBusy,
  manualTouchBusy,
  getOrderTone,
  getOrderLabel,
  getPaymentTone,
  getPaymentLabel,
  getCheckoutStageLabel,
  getCheckoutStageOrder,
}) => {
  const getAbandonmentLabel = (interval?: string | null) => {
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
  };

  if (!orderId) return null;

  return (
    <Sheet open={Boolean(orderId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-l border-border/60 sm:max-w-2xl">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-xl font-bold">Resumo do checkout</SheetTitle>
          <SheetDescription>
            Revise itens, entrega, cobrança e retomadas do pedido.
          </SheetDescription>
        </SheetHeader>

        {!order ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground animate-pulse">
            Carregando detalhes do pedido...
          </div>
        ) : (
          <div className="space-y-6 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={`border uppercase tracking-wider text-[10px] font-bold ${getOrderTone(order.status)}`}
              >
                {getOrderLabel(order.status)}
              </Badge>
              <Badge
                className={`border uppercase tracking-wider text-[10px] font-bold ${getPaymentTone(order.paymentStatus)}`}
              >
                {getPaymentLabel(order.paymentStatus)}
              </Badge>
              <Badge
                variant="outline"
                className="border-primary/20 bg-primary/5 text-[10px] font-medium text-primary"
              >
                Etapa: {getCheckoutStageLabel(session?.currentStep ?? order.status)}
              </Badge>
            </div>

            <Card className="glass-card overflow-hidden">
              <CardContent className="grid gap-2 bg-background/20 p-3 sm:grid-cols-5">
                {[
                  { index: 1, label: 'Carrinho' },
                  { index: 2, label: 'Entrega' },
                  { index: 3, label: 'Ajustes' },
                  { index: 4, label: 'cobrança' },
                  { index: 5, label: 'Pago' },
                ].map((stage) => {
                  const currentOrder = getCheckoutStageOrder(
                    session?.currentStep ?? order.status,
                  );
                  const isActive = currentOrder === stage.index;
                  const isPast = currentOrder > stage.index;

                  const stateStyles = isActive
                    ? 'border-primary/40 bg-primary/10 text-primary shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]'
                    : isPast
                      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                      : 'border-border/40 bg-background/40 text-muted-foreground/50';

                  return (
                    <div
                      key={stage.index}
                      className={`rounded-xl border p-2 transition-all ${stateStyles}`}
                    >
                      <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">
                        Etapa {stage.index}
                      </p>
                      <p className="mt-1 truncate text-[11px] font-bold">{stage.label}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="glass-card shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {listItem?.contactName || 'Cliente final'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {listItem?.contactPhone
                        ? formatPhone(listItem.contactPhone).replace('+55 ', '')
                        : 'Sem WhatsApp vinculado'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 rounded-lg text-xs font-semibold"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir conversa
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <ShoppingCart className="h-4 w-4" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">
                      Itens do pedido
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {session?.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 p-2.5"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity}x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-foreground">
                          {formatCurrency(item.lineTotal)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-border/40 pt-4">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="font-medium">
                        {formatCurrency(order.subtotalAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Frete ({order.shippingMode || 'Retirada'})</span>
                      <span className="font-medium">
                        {formatCurrency(order.freightAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 text-base font-bold text-primary">
                      <span>Total do pedido</span>
                      <span>{formatCurrency(order.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {order.paymentLinkUrl ? (
                  <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-primary">
                        cobrança gerada
                      </p>
                      <Badge
                        variant="outline"
                        className="border-primary/20 bg-background text-[10px]"
                      >
                        {order.paymentStatus}
                      </Badge>
                    </div>
                    <Button
                      className="h-10 w-full gap-2 font-bold"
                      onClick={() => window.open(order.paymentLinkUrl!, '_blank')}
                    >
                      Visualizar link de pagamento
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}

                {abandonmentTouches?.length ? (
                  <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                        Regua de abandono
                      </p>
                      <Badge
                        variant="outline"
                        className="border-amber-500/20 bg-background text-[10px] text-amber-300"
                      >
                        {abandonmentTouches.length} toque(s)
                      </Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 justify-start rounded-xl border-amber-500/20 bg-background/70"
                        onClick={() =>
                          onToggleAbandonmentPause?.(!(session?.abandonmentPaused ?? false))
                        }
                        disabled={abandonmentBusy}
                      >
                        {abandonmentBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : session?.abandonmentPaused ? (
                          <PlayCircle className="mr-2 h-4 w-4" />
                        ) : (
                          <PauseCircle className="mr-2 h-4 w-4" />
                        )}
                        {session?.abandonmentPaused ? 'Retomar mensagem' : 'Pausar mensagem'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 justify-start rounded-xl border-amber-500/20 bg-background/70"
                        onClick={() => onTriggerManualTouch?.()}
                        disabled={manualTouchBusy}
                      >
                        {manualTouchBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="mr-2 h-4 w-4" />
                        )}
                        Reenviar agora
                      </Button>
                    </div>
                    {session?.abandonmentPaused ? (
                      <p className="text-xs text-muted-foreground">
                        A mensagem automática está pausada para este checkout.
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      {abandonmentTouches.map((touch) => (
                        <div
                          key={`${touch.interval}-${touch.triggeredAt}`}
                          className="rounded-xl border border-amber-500/10 bg-background/40 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">
                              {getAbandonmentLabel(touch.interval)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDateTime(touch.triggeredAt)}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Etapa: {getCheckoutStageLabel(touch.currentStep)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="text-right text-[10px] italic text-muted-foreground/60">
                  Identificador: {order.id.split('-')[0]} • Pedido de{' '}
                  {formatDateTime(order.updatedAt)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
