import { ArrowRight, CreditCard, Inbox, MessageSquareText, Siren, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { EmptyState } from '@/shared/ui/EmptyState';
import type { Conversation, RecoveryCase, SalesPaymentLink } from '@/shared/types';

function formatCurrency(value?: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value ?? 0);
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : 'Sem data';
}

export function DashboardOperationsPanel({
  profileKey,
  recentConversations,
  recoveryPriorities,
  recentCharges,
}: {
  profileKey: 'commerce' | 'scheduling' | 'recovery' | 'service' | 'default';
  recentConversations: Conversation[];
  recoveryPriorities: RecoveryCase[];
  recentCharges: SalesPaymentLink[];
}) {
  const showRecoveryPriorities = profileKey === 'recovery';
  const showRecentCharges = profileKey === 'commerce' || profileKey === 'recovery';
  const showSidePanel = showRecoveryPriorities || showRecentCharges;

  return (
    <div
      className={
        showSidePanel
          ? 'grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]'
          : 'grid min-w-0 gap-6'
      }
    >
      <Card className="glass-card flex h-full min-w-0 flex-col overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Fila de atendimento</CardTitle>
            <Link to="/app/conversations">
              <Button variant="ghost" size="sm" className="gap-1.5">
                Abrir inbox
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Conversas mais recentes para acompanhamento rápido da operação.
          </p>
        </CardHeader>
        <CardContent className="flex-1 space-y-3">
          {recentConversations.length === 0 ? (
            <div className="py-2">
              <EmptyState
                icon={MessageSquareText}
                title="Sem conversas ativas"
                description="Ainda não existem conversas suficientes para montar a fila executiva."
              />
            </div>
          ) : (
            recentConversations.map((conversation) => (
              <Link
                key={conversation.id}
                to={`/app/conversations/${conversation.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 transition hover:border-primary/30 hover:bg-primary/[0.03]"
              >
                <div className="rounded-2xl bg-primary/10 p-2.5">
                  <MessageSquareText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {conversation.contactName}
                    </p>
                    <span className="shrink-0 self-center text-xs text-muted-foreground">
                      {formatDate(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {conversation.lastMessage || conversation.contactPhone}
                  </p>
                </div>
                <StatusBadge status={conversation.status} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {showSidePanel ? (
      <div className="flex h-full min-w-0 flex-col gap-6">
        {showRecoveryPriorities ? (
        <Card className="glass-card flex h-full min-w-0 flex-col overflow-hidden">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Prioridades de cobrança</CardTitle>
              <Link to="/app/recovery">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  Abrir carteira
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Casos que pedem ação da equipe financeira ou comercial.
            </p>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            {recoveryPriorities.length === 0 ? (
              <div className="py-2">
                <EmptyState
                  icon={Siren}
                  title="Tudo em dia"
                  description="Nenhuma prioridade de cobrança aberta neste momento."
                />
              </div>
            ) : (
              recoveryPriorities.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/60 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Siren className="h-4 w-4 text-primary" />
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.debtorName}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.chargeTitle || 'cobrança em aberto'}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{formatCurrency(item.amountDue)}</Badge>
                    {item.nextActionAt ? (
                      <Badge variant="outline">
                        Próxima ação em {formatDate(item.nextActionAt)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        ) : null}

        {showRecentCharges ? (
        <Card className="glass-card flex h-full min-w-0 flex-col overflow-hidden">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Checkouts recentes</CardTitle>
              <Link to="/app/sales/payment-links">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  Ver cobranças
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col space-y-3">
            {recentCharges.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-2">
                <EmptyState
                  icon={Wallet}
                  title="Sem vendas recentes"
                  description="Nenhuma cobrança recente para destacar no período."
                />
              </div>
            ) : (
              recentCharges.map((charge) => (
                <div key={charge.id} className="rounded-2xl border border-border/60 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        <p className="truncate text-sm font-semibold text-foreground">
                          {charge.name}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {charge.contactName || 'Sem contato vinculado'}
                      </p>
                    </div>
                    <StatusBadge status={charge.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground">
                    <CreditCard className="h-4 w-4 text-primary" />
                    {formatCurrency(charge.value)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}
