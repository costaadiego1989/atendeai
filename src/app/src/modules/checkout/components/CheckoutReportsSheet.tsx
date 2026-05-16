import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { CheckoutPageViewModel } from '@/modules/checkout/view-models/useCheckoutPageViewModel';

export function CheckoutReportsSheet({ vm }: { vm: CheckoutPageViewModel }) {
  return (
    <Sheet open={vm.reportsOpen} onOpenChange={vm.setReportsOpen}>
      <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Relatório do checkout</SheetTitle>
          <SheetDescription>
            Selecione o período e baixe um CSV com pedidos e status operacionais.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4">
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

          <div className="space-y-2">
            <Label>Status do pedido</Label>
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
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                {vm.reportStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          O CSV sai com dados do pedido, cliente, etapa do funil, valores e timestamps do checkout.
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

