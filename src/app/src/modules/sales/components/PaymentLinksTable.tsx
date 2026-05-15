import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppPagination } from '@/shared/ui/AppPagination';
import { EmptyState } from '@/shared/ui/EmptyState';
import { TableSkeleton } from '@/shared/ui/Skeletons';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import type { SalesPaymentLink, SalesPaymentLinksPage } from '@/shared/types';
import {
  Copy,
  CreditCard,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  Repeat2,
  Trash2,
  UserRound,
} from 'lucide-react';
import {
  formatSalesBillingType,
  formatSalesCurrency,
  formatSalesDueDate,
} from './sales-view-helpers';
import {
  getPaymentLinkCommercialContext,
  getPaymentLinkCommercialToneClassName,
} from '../utils/payment-link-commercial';

type Props = {
  items: SalesPaymentLink[];
  isLoading: boolean;
  isError: boolean;
  pagination?: SalesPaymentLinksPage['pagination'];
  currentItemsCount: number;
  onPageChange: (page: number) => void;
  onCopyLink: (url: string) => void;
  onPause: (item: SalesPaymentLink) => void;
  onResume: (item: SalesPaymentLink) => void;
  onDelete: (item: SalesPaymentLink) => void;
};

export function PaymentLinksTable({
  items,
  isLoading,
  isError,
  pagination,
  currentItemsCount,
  onPageChange,
  onCopyLink,
  onPause,
  onResume,
  onDelete,
}: Props) {
  if (isLoading && !items.length) {
    return (
      <div className="p-6">
        <TableSkeleton cols={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Não foi possível carregar as cobranças"
        description="Tente novamente em instantes para listar a operação."
      />
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Nenhuma cobrança encontrada"
        description="Crie a primeira cobrança com split para iniciar a operação."
      />
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cobrança</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const commercial = getPaymentLinkCommercialContext(item);

            return (
              <TableRow key={item.id}>
                <TableCell className="align-top">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <Badge
                        variant="secondary"
                        className="rounded-full px-2.5 py-1 text-[11px]"
                      >
                        {commercial.channelLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`rounded-full px-2.5 py-1 text-[11px] ${getPaymentLinkCommercialToneClassName(commercial.tone)}`}
                      >
                        {commercial.kindLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`rounded-full px-2.5 py-1 text-[11px] ${getPaymentLinkCommercialToneClassName(commercial.tone)}`}
                      >
                        {commercial.statusLabel}
                      </Badge>
                      {item.recurrenceEnabled ? (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full px-2.5 py-1 text-[11px]"
                        >
                          <Repeat2 className="h-3 w-3" />
                          Recorrente
                        </Badge>
                      ) : null}
                      <Badge
                        variant="outline"
                        className="rounded-full px-2.5 py-1 text-[11px]"
                      >
                        {item.source === 'AI' ? 'IA' : 'Manual'}
                      </Badge>
                      {item.label ? (
                        <Badge
                          variant="outline"
                          className="rounded-full px-2.5 py-1 text-[11px]"
                        >
                          {item.label}
                        </Badge>
                      ) : null}
                    </div>
                    {item.contactName ? (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <UserRound className="h-3.5 w-3.5" />
                        <span>{item.contactName}</span>
                      </div>
                    ) : null}
                    {item.description ? (
                      <p className="max-w-[520px] text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {formatSalesBillingType(item.billingType)}
                    </p>
                    {item.recurrenceEnabled ? (
                      <p className="text-xs text-muted-foreground">
                        {formatRecurrenceFrequency(item.recurrenceFrequency)}
                        {item.recurrenceEndDate
                          ? ` até ${formatSalesDueDate(item.recurrenceEndDate)}`
                          : ''}
                        {item.recurrenceTotalValue
                          ? ` - total ${formatSalesCurrency(item.recurrenceTotalValue)}`
                          : ''}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="align-top font-semibold text-foreground">
                  {formatSalesCurrency(item.value)}
                </TableCell>
                <TableCell className="align-top">
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="align-top text-muted-foreground">
                  {formatSalesDueDate(item.expiresAt)}
                </TableCell>
                <TableCell className="align-top text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => onCopyLink(item.url)}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir
                    </Button>
                    {item.status === 'ACTIVE' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => onPause(item)}
                      >
                        <PauseCircle className="h-4 w-4" />
                        Pausar
                      </Button>
                    ) : null}
                    {item.status === 'PAUSED' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => onResume(item)}
                      >
                        <PlayCircle className="h-4 w-4" />
                        Reativar
                      </Button>
                    ) : null}
                    {item.status !== 'DELETED' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => onDelete(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {pagination ? (
        <div className="p-4 border-t border-border/60 bg-muted/5">
          <AppPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            currentItemsCount={currentItemsCount}
            itemLabel="cobranças"
            onPageChange={onPageChange}
            className="border-none pt-0"
          />
        </div>
      ) : null}
    </>
  );
}

function formatRecurrenceFrequency(frequency?: SalesPaymentLink['recurrenceFrequency']) {
  const labels: Record<string, string> = {
    WEEKLY: 'Semanal',
    MONTHLY: 'Mensal',
    QUARTERLY: 'Trimestral',
    YEARLY: 'Anual',
  };

  return frequency ? labels[frequency] ?? frequency : 'Recorrente';
}
