import { Search, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/shared/ui/EmptyState';
import { AppPagination } from '@/shared/ui/AppPagination';
import { PageSkeleton } from '@/shared/ui/Skeletons';
import { usePlatformTenantsPageViewModel } from '../view-models/usePlatformTenantsPageViewModel';
import { PlatformTenantsHeader } from '../components/PlatformTenantsHeader';
import { PlatformTenantsKPIs } from '../components/PlatformTenantsKPIs';
import type { PlatformTenantOverviewItemDto } from '../types/platform-admin.types';
import { PlatformTenantActionsSheet } from '../components/PlatformTenantActionsSheet';

function quotaCell(
  row: PlatformTenantOverviewItemDto,
  kind: 'messages' | 'aiTokens' | 'contacts',
) {
  const limit = row.quotas[kind].limit;
  const used = row.usage[kind].used;
  if (limit <= 0 && used <= 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium">
        {used.toLocaleString('pt-BR')} / {limit.toLocaleString('pt-BR')}
      </p>
      {pct !== null ? (
        <p className="text-xs text-muted-foreground">{pct}% do limite</p>
      ) : null}
    </div>
  );
}

export default function PlatformTenantsPage() {
  const vm = usePlatformTenantsPageViewModel();
  const q = vm.tenantsQuery;
  const data = q.data;
  const items = data?.items ?? [];
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTenant, setActiveTenant] = useState<PlatformTenantOverviewItemDto | null>(
    null,
  );

  function openActions(row: PlatformTenantOverviewItemDto) {
    setActiveTenant(row);
    setSheetOpen(true);
  }

  if (vm.configErrorMessage) {
    return (
      <div className="page-container animate-fade-in">
        <PlatformTenantsHeader />
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Configuração necessária</AlertTitle>
          <AlertDescription>{vm.configErrorMessage}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <PlatformTenantsHeader />

      <div className="glass-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="platform-tenant-search"
              placeholder="Buscar empresa, CNPJ ou ID..."
              className="pl-9"
              value={vm.listSearch}
              onChange={(e) => vm.setListSearch(e.target.value)}
              disabled={q.isFetching && !q.data}
            />
          </div>
        </div>
      </div>

      {vm.listErrorMessage ? (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Falha ao carregar tenants</AlertTitle>
          <AlertDescription>{vm.listErrorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {!q.isLoading && data ? (
        <PlatformTenantsKPIs items={items} totalAcrossPages={data.total} />
      ) : null}

      <Card className="glass-card border-border/40 bg-background/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
          <p className="text-sm text-muted-foreground">
            Abra um tenant em <strong>Ações</strong> para deltas de quotas (somam aos limites atuais na API),
            gerar texto com IA ou enfileirar WhatsApp ao proprietário.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={q.isFetching}
            onClick={() => void q.refetch()}
          >
            Atualizar
          </Button>
        </CardContent>
      </Card>

      {q.isLoading ? (
        <PageSkeleton />
      ) : !data || items.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="Nenhum tenant encontrado"
          description="A primeira página pode estar vazia ou não há registros cadastrados."
        />
      ) : (
        <div className="space-y-4">
          <PlatformTenantActionsSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            tenant={activeTenant}
          />

          <Card className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano tenant</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead>Mensagens</TableHead>
                  <TableHead>Tokens IA</TableHead>
                  <TableHead>Contatos</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.tenantId}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{row.companyName}</p>
                        <p className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                          {row.tenantId}
                        </p>
                        <p className="text-xs text-muted-foreground">CNPJ: {row.cnpj}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{row.tenantPlan}</Badge>
                        <Badge variant="secondary">{row.tenantPlanStatus}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.subscription ? (
                        <div className="space-y-1">
                          <Badge>{row.subscription.status}</Badge>
                          <p className="text-xs text-muted-foreground">{row.subscription.plan}</p>
                          <p className="text-xs text-muted-foreground">
                            Ciclo:{' '}
                            {new Date(row.subscription.cycleStart).toLocaleDateString('pt-BR')} —{' '}
                            {new Date(row.subscription.cycleEnd).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sem assinatura</span>
                      )}
                    </TableCell>
                    <TableCell>{quotaCell(row, 'messages')}</TableCell>
                    <TableCell>{quotaCell(row, 'aiTokens')}</TableCell>
                    <TableCell>{quotaCell(row, 'contacts')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(row.tenantCreatedAt).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          openActions(row);
                        }}
                      >
                        Abrir folha
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <AppPagination
            page={vm.page}
            totalPages={data.totalPages}
            totalItems={data.total}
            currentItemsCount={items.length}
            itemLabel="tenants"
            onPageChange={vm.setPage}
          />
        </div>
      )}
    </div>
  );
}
