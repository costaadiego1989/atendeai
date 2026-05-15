import { CalendarClock, FileText, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { formatCurrency, formatDate, formatDateTime } from '@/shared/lib/formatters';
import type { ProposalRecord } from '../types';
import { ProposalActionsMenu } from './ProposalActionsMenu';
import {
  getProposalDisplayTotal,
  getProposalFinalPrice,
  getResolvedProposalPublicUrl,
} from '../utils/proposal-finance';
import {
  getProposalCommercialJourney,
  getProposalJourneyToneClassName,
} from '../utils/proposal-commercial';

type Props = {
  proposal: ProposalRecord | null;
  contactNameMap: Record<string, string>;
  onOpen: (proposal: ProposalRecord) => void;
  onEdit: (proposal: ProposalRecord) => void;
  onGeneratePdf: (proposal: ProposalRecord) => void;
  onSend: (proposal: ProposalRecord) => void;
  onSchedule: (proposal: ProposalRecord) => void;
  onDelete: (proposal: ProposalRecord) => void;
};

type ProposalJourneyStepRowProps = {
  title: string;
  label: string;
  toneClassName: string;
};

function ProposalJourneyStepRow({
  title,
  label,
  toneClassName,
}: ProposalJourneyStepRowProps) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/45 px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-medium text-foreground">{title}</span>
      <Badge
        variant="outline"
          className={`w-fit rounded-full px-2.5 py-1 text-[11px] ${toneClassName}`}
      >
        {label}
      </Badge>
      </div>
    </div>
  );
}

type ProposalMetaInfoCardProps = {
  title: string;
  value: string;
};

function ProposalMetaInfoCard({ title, value }: ProposalMetaInfoCardProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function ProposalDetailPanel({
  proposal,
  contactNameMap,
  onOpen,
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
  const publicUrl = getResolvedProposalPublicUrl(proposal);

  return (
    <Card className="glass-card h-full overflow-hidden">
      <CardHeader className="border-b border-border/40 bg-gradient-to-b from-muted/30 to-background">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                Detalhes da proposta
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-bold tracking-tight text-foreground">{proposal.title}</h3>
                <StatusBadge status={proposal.status} />
              </div>
            </div>

            <ProposalActionsMenu
              proposal={proposal}
              onOpen={onOpen}
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
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
          <div className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Valor
              </p>
              {finalPrice !== null ? (
                <Badge variant="outline" className="shrink-0 rounded-full px-2.5 py-1 text-[11px]">
                  Preço final
                </Badge>
              ) : null}
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(effectiveTotal) ?? 'R$ 0,00'}
              </p>
              <p className="text-sm text-muted-foreground">
                {proposal.items.length} item(s) compõem esta proposta
              </p>
              {finalPrice !== null ? (
                <p className="text-xs text-muted-foreground">
                  Base calculada: {formatCurrency(proposal.totalAmount) ?? 'R$ 0,00'}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Jornada comercial
            </p>
            <div className="mt-3 grid gap-2.5">
              {[journey.contract, journey.approval, journey.payment].map((step) => (
                <ProposalJourneyStepRow
                  key={`${step.title}-${step.label}`}
                  title={step.title}
                  label={step.label}
                  toneClassName={getProposalJourneyToneClassName(step.tone)}
                />
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{journey.summary}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ProposalMetaInfoCard
            title="Agendamento"
            value={proposal.scheduledAt ? 'Programado' : 'Não programado'}
          />
          <ProposalMetaInfoCard
            title="Validade"
            value={
              proposal.validUntil
                ? formatDate(proposal.validUntil) ?? 'Sem data'
                : 'Sem validade'
            }
          />
        </div>

        {proposal.description || proposal.benefits ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {proposal.description ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Descrição
                </p>
                <p className="mt-3 text-sm leading-6 text-foreground/90">{proposal.description}</p>
              </div>
            ) : null}
            {proposal.benefits ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Benefícios
                </p>
                <p className="mt-3 text-sm leading-6 text-foreground/90">{proposal.benefits}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Itens da proposta
            </h3>
            <Badge variant="secondary">{proposal.items.length} item(s)</Badge>
          </div>

          <div className="space-y-3">
            {proposal.items.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="rounded-2xl border border-border/60 bg-background/60 p-4"
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    {item.description ? (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Quantidade: {item.quantity} | Valor unitário:{' '}
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

        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
          <p className="text-sm font-semibold text-foreground">Fluxo de envio automatizado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O envio principal desta proposta acontece pela conversa com um link do contrato digital.
            Depois do aceite, o cliente segue para o pagamento e o webhook confirma a conclusão no chat.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSend(proposal)}
            >
              Enviar na conversa
            </Button>
            {proposal.pdfUrl ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGeneratePdf(proposal)}
              >
                Baixar PDF gerado
              </Button>
            ) : null}
            {publicUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  Abrir contrato
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
