import { CalendarClock, Eye, FileDown, Pencil, Send, Trash2, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { TableSkeleton } from '@/shared/ui/Skeletons';
import { formatCurrency, formatDateTime } from '@/shared/lib/formatters';
import type { ProposalRecord } from '../types';

type Props = {
  items: ProposalRecord[];
  selectedId: string | null;
  isLoading: boolean;
  isError: boolean;
  contactNameMap: Record<string, string>;
  onSelect: (proposalId: string) => void;
  onEdit: (proposal: ProposalRecord) => void;
  onGeneratePdf: (proposal: ProposalRecord) => void;
  onSchedule: (proposal: ProposalRecord) => void;
  onDelete: (proposal: ProposalRecord) => void;
};

function hasFinalPrice(proposal: ProposalRecord) {
  if (!proposal.metadata || typeof proposal.metadata !== 'object') {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(proposal.metadata, 'finalPrice');
}

export function ProposalList({
  items,
  selectedId,
  isLoading,
  isError,
  contactNameMap,
  onSelect,
  onEdit,
  onGeneratePdf,
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
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Total da proposta
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(proposal.totalAmount) ?? 'R$ 0,00'}
                    </p>
                    {hasFinalPrice(proposal) ? (
                      <p className="text-xs text-muted-foreground">Preço final salvo no registro</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </button>

            <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-muted-foreground">
                {proposal.items.length} item(s) em {proposal.status.toLowerCase()}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(proposal.id);
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Abrir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(proposal);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={(event) => {
                    event.stopPropagation();
                    onGeneratePdf(proposal);
                  }}
                >
                  <FileDown className="h-4 w-4" />
                  Baixar PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSchedule(proposal);
                  }}
                >
                  <Send className="h-4 w-4" />
                  Agendar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 rounded-xl text-destructive hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(proposal);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
