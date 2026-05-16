import { Badge } from '@/components/ui/badge';
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
import { MultiSelectFilter } from '@/shared/ui/MultiSelectFilter';
import type { CatalogPageViewModel } from '@/modules/catalog/view-models/useCatalogPageViewModel';

type Props = {
  vm: CatalogPageViewModel;
};

export function CatalogReportsSheet({ vm }: Props) {
  return (
    <Sheet open={vm.reportsOpen} onOpenChange={vm.setReportsOpen}>
      <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Exportar catálogo</SheetTitle>
          <SheetDescription>
            Gere um CSV com os itens do catálogo filtrando por tipo, categoria, busca e status.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4">
          <div className="space-y-2">
            <Label>Busca</Label>
            <Input
              value={vm.reportFilters.query}
              onChange={(event) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  query: event.target.value,
                }))
              }
              placeholder="Nome, descrição ou termo comercial"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <MultiSelectFilter
              value={vm.reportFilters.types}
              options={[
                { value: 'SERVICE', label: 'serviços' },
                { value: 'PRODUCT', label: 'Produtos' },
                { value: 'RENTAL', label: 'Locacoes' },
              ]}
              onChange={(value) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  types: value as typeof current.types,
                }))
              }
              placeholder="Tipos"
              allLabel="Todos os tipos"
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <MultiSelectFilter
              value={vm.reportFilters.categoryIds}
              options={(vm.categoriesQuery.data ?? []).map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              onChange={(value) =>
                vm.setReportFilters((current) => ({
                  ...current,
                  categoryIds: value,
                }))
              }
              placeholder="Categorias"
              allLabel="Todas as categorias"
            />
          </div>

          <Button
            type="button"
            variant={vm.reportFilters.includeInactive ? 'default' : 'outline'}
            className="justify-start"
            onClick={() =>
              vm.setReportFilters((current) => ({
                ...current,
                includeInactive: !current.includeInactive,
              }))
            }
          >
            {vm.reportFilters.includeInactive
              ? 'Incluir itens inativos'
              : 'Somente itens ativos'}
          </Button>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          O arquivo sai com nome, tipo, categoria, status, preço base, tags, origem,
          referência externa e datas de criação e atualização.
        </div>

        {vm.activeReportJob && (
          <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{vm.activeReportJob.status}</Badge>
              <Badge variant="secondary">{vm.activeReportJob.progress}%</Badge>
              {vm.activeReportJob.totalItems > 0 && (
                <Badge variant="secondary">
                  {vm.activeReportJob.processedItems}/{vm.activeReportJob.totalItems}
                </Badge>
              )}
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {vm.activeReportJob.status === 'QUEUED' &&
                'Seu CSV entrou na fila. Assim que terminar, o download sera iniciado automaticamente.'}
              {vm.activeReportJob.status === 'PROCESSING' &&
                'Estamos consolidando os itens do catálogo e montando o arquivo em segundo plano.'}
              {vm.activeReportJob.status === 'COMPLETED' &&
                `CSV pronto${vm.activeReportJob.fileName ? `: ${vm.activeReportJob.fileName}` : ''}.`}
              {vm.activeReportJob.status === 'FAILED' &&
                (vm.activeReportJob.errorMessage ??
                  'Não foi possível gerar o CSV deste Relatório.')}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => vm.setReportsOpen(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => vm.syncReportSummaryMutation.mutate(vm.reportFilters)}
            disabled={vm.syncReportSummaryMutation.isPending}
          >
            {vm.syncReportSummaryMutation.isPending ? 'Calculando...' : 'Ver resumo agora'}
          </Button>
          <Button
            onClick={() => vm.generateReportMutation.mutate(vm.reportFilters)}
            disabled={vm.generateReportMutation.isPending}
          >
            {vm.generateReportMutation.isPending ? 'Enfileirando...' : 'Baixar CSV'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
