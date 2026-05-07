import { CalendarClock, FileText, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { formatCurrency, formatDate, formatDateTime } from '@/shared/lib/formatters';
import type { ProposalRecord } from '../types';
import { ProposalActionsMenu } from './ProposalActionsMenu';
import {
  getProposalDisplayTotal,
  getProposalFinalPrice,
} from '../utils/proposal-finance';
import {
  getProposalCommercialJourney,
  getProposalJourneyToneClassName,
} from '../utils/proposal-commercial';

type Props = {
  proposal: ProposalRecord | null;
  contactNameMap: Record<string, string>;
  onEdit: (proposal: ProposalRecord) => void;
  onGeneratePdf: (proposal: ProposalRecord) => void;
  onSend: (proposal: ProposalRecord) => void;
  onSchedule: (proposal: ProposalRecord) => void;
  onDelete: (proposal: ProposalRecord) => void;
};

export function ProposalDetailPanel({
  proposal,
  contactNameMap,
  onEdit,
  onGeneratePdf,
  onSend,
  onSchedule,
  onDelete,
}: Props) {
  if (!proposal) {
    return (
      <Card className="glass-card h-full">
        <CardContent className="p-6">
          <EmptyState
            icon={FileText}
            title="Selecione uma proposta"
            description="Abra um item da lista para ver os detalhes, editar, gerar PDF ou acompanhar o envio comercial."
          />
        </CardContent>
      </Card>
    );
  }

  const contactLabel = contactNameMap[proposal.contactId] ?? proposal.contactId;
  const finalPrice = getProposalFinalPrice(proposal);
  const effectiveTotal = getProposalDisplayTotal(proposal);
  const journey = getProposalCommercialJourney(proposal);

  return (
    <Card className="glass-card h-full overflow-hidden">
      <CardHeader className="border-b border-border/40 bg-gradient-to-b from-muted/30 to-background">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                Detalhes da proposta
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-bold tracking-tight text-foreground">{proposal.title}</h3>
                <StatusBadge status={proposal.status} />
              </div>
            </div>

            <ProposalActionsMenu
              proposal={proposal}
              onEdit={onEdit}
              onGeneratePdf={onGeneratePdf}
              onSend={onSend}
              onSchedule={onSchedule}
              onDelete={onDelete}
            />
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4" />
              {contactLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" />
              Atualizada em {formatDateTime(proposal.updatedAt) ?? 'sem data'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-border/60 bg-background/60 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                Valor
              </p>
              {finalPrice !== null ? (
                <Badge variant="outline" className="shrink-0 rounded-full px-2.5 py-1 text-[11px]">
                  Preco final
                </Badge>
              ) : null}
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(effectiveTotal) ?? 'R$ 0,00'}
              </p>
              <p className="text-sm text-muted-foreground">
                {proposal.items.length} item(s) compoem esta proposta
              </p>
              {finalPrice !== null ? (
                <p className="text-xs text-muted-foreground">
                  Base calculada: {formatCurrency(proposal.totalAmount) ?? 'R$ 0,00'}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-background/60 p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              Jornada comercial
            </p>
            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
              {[journey.contract, journey.approval, journey.payment].map((step) => (
                <div key={step.label} className="flex items-center justify-between gap-3">
                  <span>{step.title}</span>
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2.5 py-1 text-[11px] ${getProposalJourneyToneClassName(step.tone)}`}
                  >
                    {step.label}
                  </Badge>
                </div>
              ))}
              <p>Agendamento: {proposal.scheduledAt ? 'Programado' : 'Nao programado'}</p>
              <p>
                Validade:{' '}
                {proposal.validUntil ? formatDate(proposal.validUntil) ?? 'Sem data' : 'Sem validade'}
              </p>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">{journey.summary}</p>
          </div>
        </div>

        {proposal.description || proposal.benefits ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {proposal.description ? (
              <div className="rounded-3xl border border-border/60 bg-background/60 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                  Descricao
                </p>
                <p className="mt-3 text-sm leading-6 text-foreground/90">{proposal.description}</p>
              </div>
            ) : null}
            {proposal.benefits ? (
              <div className="rounded-3xl border border-border/60 bg-background/60 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                  Beneficios
                </p>
                <p className="mt-3 text-sm leading-6 text-foreground/90">{proposal.benefits}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              Itens da proposta
            </h3>
            <Badge variant="secondary">{proposal.items.length} item(s)</Badge>
          </div>

          <div className="space-y-3">
            {proposal.items.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="rounded-3xl border border-border/60 bg-background/60 p-4"
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    {item.description ? (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Quantidade: {item.quantity} | Valor unitario:{' '}
                      {formatCurrency(item.unitPrice) ?? 'R$ 0,00'}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(item.subtotal ?? item.quantity * item.unitPrice) ?? 'R$ 0,00'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-primary/15 bg-primary/5 p-5">
          <p className="text-sm font-semibold text-foreground">Fluxo de envio automatizado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O envio principal desta proposta acontece pela conversa com um link do contrato digital.
            Depois do aceite, o cliente segue para o pagamento e o webhook confirma a conclusao no chat.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
              onClick={() => onSend(proposal)}
            >
              Enviar na conversa
            </button>
            {proposal.pdfUrl ? (
              <button
                type="button"
                className="inline-flex items-center rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
                onClick={() => onGeneratePdf(proposal)}
              >
                Baixar PDF gerado
              </button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
