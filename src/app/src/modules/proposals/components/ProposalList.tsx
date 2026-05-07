import { CalendarClock, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { TableSkeleton } from '@/shared/ui/Skeletons';
import { formatCurrency, formatDateTime } from '@/shared/lib/formatters';
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
  items: ProposalRecord[];
  selectedId: string | null;
  isLoading: boolean;
  isError: boolean;
  contactNameMap: Record<string, string>;
  onSelect: (proposalId: string) => void;
  onEdit: (proposal: ProposalRecord) => void;
  onGeneratePdf: (proposal: ProposalRecord) => void;
  onSend: (proposal: ProposalRecord) => void;
  onSchedule: (proposal: ProposalRecord) => void;
  onDelete: (proposal: ProposalRecord) => void;
};

export function ProposalList({
  items,
  selectedId,
  isLoading,
  isError,
  contactNameMap,
  onSelect,
  onEdit,
  onGeneratePdf,
  onSend,
  onSchedule,
  onDelete,
}: Props) {
  if (isLoading && !items.length) {
    return (
      <div className="space-y-3 p-4">
        <TableSkeleton cols={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={FileDown}
        title="Não foi possível carregar as propostas"
        description="Tente novamente em instantes para listar a operação comercial."
      />
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={FileDown}
        title="Nenhuma proposta encontrada"
        description="Crie a primeira proposta para iniciar o fluxo comercial."
      />
    );
  }

  return (
    <div className="space-y-4">
      {items.map((proposal) => {
        const selected = proposal.id === selectedId;
        const contactLabel = contactNameMap[proposal.contactId] ?? proposal.contactId;
        const finalPrice = getProposalFinalPrice(proposal);
        const effectiveTotal = getProposalDisplayTotal(proposal);
        const journey = getProposalCommercialJourney(proposal);

        return (
          <Card
            key={proposal.id}
            className={[
              'group overflow-hidden border-border/60 bg-background/70 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-background/90 hover:shadow-lg',
              selected ? 'border-primary/40 ring-1 ring-primary/20' : '',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => onSelect(proposal.id)}
              className="block w-full text-left"
            >
              <div className="border-b border-border/40 bg-gradient-to-r from-primary/5 via-background to-transparent px-4 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="max-w-[420px] truncate text-base font-semibold text-foreground">
                        {proposal.title}
                      </p>
                      <StatusBadge status={proposal.status} />
                      {proposal.pdfUrl ? (
                        <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                          PDF pronto
                        </Badge>
                      ) : null}
                      {[journey.contract, journey.approval, journey.payment]
                        .filter((step) => step.visible)
                        .map((step) => (
                          <Badge
                            key={step.label}
                            variant="outline"
                            className={`rounded-full px-2.5 py-1 text-[11px] ${getProposalJourneyToneClassName(step.tone)}`}
                          >
                            {step.label}
                          </Badge>
                        ))}
                      {proposal.scheduledAt ? (
                        <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                          Agendada
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />
                        {contactLabel}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Atualizada em {formatDateTime(proposal.updatedAt) ?? 'sem data'}
                      </span>
                      {proposal.validUntil ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Válida até {formatDateTime(proposal.validUntil) ?? 'sem data'}
                        </span>
                      ) : null}
                    </div>

                    {proposal.description ? (
                      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                        {proposal.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Sem descrição cadastrada para esta proposta.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{journey.summary}</p>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end lg:pl-6">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {finalPrice !== null ? 'Preço final' : 'Total da proposta'}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(effectiveTotal) ?? 'R$ 0,00'}
                    </p>
                    {finalPrice !== null ? (
                      <p className="text-xs text-muted-foreground">
                        Base calculada: {formatCurrency(proposal.totalAmount) ?? 'R$ 0,00'}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </button>

            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <div className="text-sm text-muted-foreground">
                {proposal.items.length} item(s) em {proposal.status.toLowerCase()}
              </div>

              <ProposalActionsMenu
                proposal={proposal}
                onOpen={onSelect}
                onEdit={onEdit}
                onGeneratePdf={onGeneratePdf}
                onSend={onSend}
                onSchedule={onSchedule}
                onDelete={onDelete}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
