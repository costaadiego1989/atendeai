import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaymentLinksPageViewModel } from '@/modules/sales/view-models/usePaymentLinksPageViewModel';

export function SalesReportsSheet({ vm }: { vm: PaymentLinksPageViewModel }) {
  return (
    <Sheet open={vm.reportsOpen} onOpenChange={vm.setReportsOpen}>
      <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Relatório de cobranças</SheetTitle>
          <SheetDescription>
            Selecione os filtros e baixe um CSV com as cobranças do período.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4">
          <div className="space-y-2">
            <Label>Buscar no CSV</Label>
            <Input
              value={vm.reportFilters.search}
              onChange={(event) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Título, descrição ou contato"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={vm.reportFilters.status}
                onValueChange={(value) =>
                  vm.setReportFilters((current) => ({
                    ...current,
                    status: value as typeof current.status,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Ativas</SelectItem>
                  <SelectItem value="PAUSED">Pausadas</SelectItem>
                  <SelectItem value="DELETED">Removidas</SelectItem>
                  <SelectItem value="PAID">Pagas</SelectItem>
                  <SelectItem value="OVERDUE">Vencidas</SelectItem>
                  <SelectItem value="REFUNDED">Estornadas</SelectItem>
                  <SelectItem value="EXPIRED">Expiradas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Origem</Label>
              <Select
                value={vm.reportFilters.source}
                onValueChange={(value) =>
                  vm.setReportFilters((current) => ({
                    ...current,
                    source: value as typeof current.source,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="AI">IA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data inicial</Label>
              <Input
                type="date"
                value={vm.reportFilters.dateFrom}
                onChange={(event) =>
                  vm.setReportFilters((current) => ({
                    ...current,
                    dateFrom: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Data final</Label>
              <Input
                type="date"
                value={vm.reportFilters.dateTo}
                onChange={(event) =>
                  vm.setReportFilters((current) => ({
                    ...current,
                    dateTo: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          O CSV sai com nome, valor, vencimento, status, origem, contato e link do checkout.
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setReportsOpen(false)}>
            Fechar
          </Button>
          <Button onClick={vm.confirmDownloadReport} disabled={vm.downloadReportMutation.isPending}>
            {vm.downloadReportMutation.isPending ? 'Baixando...' : 'Baixar CSV'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

