import { CalendarClock, Download, FileText, Send, Trash2, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { formatCurrency, formatDate, formatDateTime } from '@/shared/lib/formatters';
import type { ProposalRecord } from '../types';

type Props = {
  proposal: ProposalRecord | null;
  contactNameMap: Record<string, string>;
  onEdit: (proposal: ProposalRecord) => void;
  onGeneratePdf: (proposal: ProposalRecord) => void;
  onSchedule: (proposal: ProposalRecord) => void;
  onDelete: (proposal: ProposalRecord) => void;
};

function getFinalPrice(metadata: ProposalRecord['metadata']) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const raw = (metadata as Record<string, unknown>).finalPrice;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function ProposalDetailPanel({
  proposal,
  contactNameMap,
  onEdit,
  onGeneratePdf,
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
            description="Abra um item da lista para ver os detalhes, editar, gerar PDF ou agendar o envio."
          />
        </CardContent>
      </Card>
    );
  }

  const contactLabel = contactNameMap[proposal.contactId] ?? proposal.contactId;
  const finalPrice = getFinalPrice(proposal.metadata);
  const effectiveTotal = finalPrice ?? proposal.totalAmount;

  return (
    <Card className="glass-card h-full overflow-hidden">
      <CardHeader className="border-b border-border/40 bg-muted/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <CardTitle className="text-base uppercase tracking-widest text-muted-foreground">
              Detalhes da proposta
            </CardTitle>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-bold text-foreground">{proposal.title}</p>
                <StatusBadge status={proposal.status} />
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
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => onEdit(proposal)}>
              <FileText className="h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => onGeneratePdf(proposal)}
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => onSchedule(proposal)}>
              <Send className="h-4 w-4" />
              Agendar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => onDelete(proposal)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {finalPrice ? 'Preço final' : 'Total'}
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {formatCurrency(effectiveTotal) ?? 'R$ 0,00'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {proposal.items.length} item(s) compõem esta proposta
            </p>
            {finalPrice ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Total calculado: {formatCurrency(proposal.totalAmount) ?? 'R$ 0,00'}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Envio
            </p>
            <div className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
              <span>PDF: {proposal.pdfUrl ? 'Disponível' : 'Ainda não gerado'}</span>
              <span>Agendamento: {proposal.scheduledAt ? 'Programado' : 'Não programado'}</span>
              <span>
                Validade:{' '}
                {proposal.validUntil ? formatDate(proposal.validUntil) ?? 'Sem data' : 'Sem validade'}
              </span>
            </div>
          </div>
        </div>

        {proposal.description || proposal.benefits ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {proposal.description ? (
              <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Descrição
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground/90">{proposal.description}</p>
              </div>
            ) : null}
            {proposal.benefits ? (
              <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Benefícios
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground/90">{proposal.benefits}</p>
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
                className="rounded-2xl border border-border/60 bg-background/50 p-4"
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

        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-foreground">Fluxo de envio automatizado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando você agenda esta proposta, o worker de entrega dispara a mensagem para o contato
            com o link do PDF no horário escolhido.
          </p>
          {proposal.pdfUrl ? (
            <Button
              variant="link"
              className="mt-2 h-auto p-0 text-primary"
              onClick={() => window.open(proposal.pdfUrl ?? '', '_blank', 'noopener,noreferrer')}
            >
              Abrir PDF gerado
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
