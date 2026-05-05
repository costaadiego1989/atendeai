import { useRef, type ChangeEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { downloadCatalogImportTemplate } from '@/shared/lib/import-templates';
import { TagInput } from '@/shared/ui/TagInput';
import type { CatalogAsyncJob, CatalogCategory } from '@/shared/types';

interface CatalogImportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    rawText: string;
    defaultType: 'PRODUCT' | 'SERVICE' | 'RENTAL';
    defaultCategoryName: string;
    defaultSource: 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT';
    defaultTags: string;
    syncInventory: boolean;
  };
  categories: CatalogCategory[];
  previewCount: number;
  activeJob?: CatalogAsyncJob | null;
  isPending: boolean;
  onFormChange: <
    K extends 'rawText' | 'defaultType' | 'defaultCategoryName' | 'defaultSource' | 'defaultTags' | 'syncInventory'
  >(
    field: K,
    value: K extends 'syncInventory' ? boolean : string,
  ) => void;
  onSubmit: () => void;
}

export function CatalogImportSheet({
  open,
  onOpenChange,
  form,
  categories,
  previewCount,
  activeJob,
  isPending,
  onFormChange,
  onSubmit,
}: CatalogImportSheetProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onFormChange('rawText', String(reader.result ?? ''));
      event.target.value = '';
    };
    reader.readAsText(file, 'utf-8');
  }

  const previewItems = activeJob?.resultSummary?.previewItems ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[760px] overflow-y-auto sm:max-w-[760px]">
        <SheetHeader>
          <SheetTitle>Importar itens do catalogo</SheetTitle>
          <SheetDescription>
            Cole uma planilha ou envie um arquivo `.csv/.txt`. O importador tenta reconhecer
            colunas como nome, preço, categoria, sku, estoque e referência mesmo fora do nosso schema.
            <span className="mt-2 block font-mono text-xs text-foreground/80">
              Ex: nome | preço | categoria | sku | estoque | tags
            </span>
            <span className="mt-2 block text-xs text-muted-foreground">
              Para bases grandes, prefira baixar o modelo oficial e preencher conforme a nossa estrutura.
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo padrao</Label>
            <Select
              value={form.defaultType}
              onValueChange={(value) => onFormChange('defaultType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRODUCT">Produto</SelectItem>
                <SelectItem value="SERVICE">serviço</SelectItem>
                <SelectItem value="RENTAL">Locação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Origem padrao</Label>
            <Select
              value={form.defaultSource}
              onValueChange={(value) => onFormChange('defaultSource', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IMPORT">Importado</SelectItem>
                <SelectItem value="MANUAL">Manual</SelectItem>
                <SelectItem value="ERP_SNAPSHOT">ERP snapshot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Categoria padrao</Label>
            <Select
              value={form.defaultCategoryName || 'none'}
              onValueChange={(value) =>
                onFormChange('defaultCategoryName', value === 'none' ? '' : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria padrao</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tags padrao</Label>
            <TagInput
              value={form.defaultTags}
              onChange={(value) => onFormChange('defaultTags', value)}
              placeholder="Digite uma tag e pressione Enter"
            />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <Label>Lista para importar</Label>
              <p className="text-xs text-muted-foreground">
                O importador aceita delimitadores como `;`, `,`, `tab` e `|`.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 px-4"
                onClick={downloadCatalogImportTemplate}
              >
                Baixar modelo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button type="button" variant="outline" className="h-10 px-4" onClick={handlePickFile}>
                Carregar CSV/TXT
              </Button>
            </div>
          </div>

          <Textarea
            value={form.rawText}
            onChange={(event) => onFormChange('rawText', event.target.value)}
            className="min-h-[260px] font-mono text-sm"
            placeholder={`produto,nome,preço,categoria,sku,estoque\nPRODUCT,Cafe especial,24.90,Bebidas,CAF-001,18`}
          />
          <p className="text-xs text-muted-foreground">
            {previewCount} linhas detectadas. Se houver colunas de estoque e a opção abaixo estiver ativa,
            tambem vamos sincronizar o inventario.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-border/60 bg-muted/15 p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="catalog-sync-inventory"
              checked={form.syncInventory}
              onCheckedChange={(checked) => onFormChange('syncInventory', checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="catalog-sync-inventory">Sincronizar estoque quando houver dados operacionais</Label>
              <p className="text-xs text-muted-foreground">
                Se a planilha trouxer `sku`, `estoque`, `status` ou `preço atual`, criamos/atualizamos
                o snapshot no módulo de estoque para `PRODUCT` e `RENTAL`.
              </p>
            </div>
          </div>
        </div>

        {activeJob && (
          <div className="mt-6 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{activeJob.status}</Badge>
              <Badge variant="secondary">{activeJob.progress}%</Badge>
              {activeJob.totalItems > 0 && (
                <Badge variant="secondary">
                  {activeJob.processedItems}/{activeJob.totalItems}
                </Badge>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {activeJob.status === 'QUEUED' &&
                'Sua importação entrou na fila. Voce pode fechar esta tela enquanto seguimos processando.'}
              {activeJob.status === 'PROCESSING' &&
                'A base esta sendo ajustada ao nosso modelo e os itens serao criados em segundo plano.'}
              {activeJob.status === 'COMPLETED' &&
                'Importação concluida. Abaixo mostramos o resumo e as principais linhas com atenção.'}
              {activeJob.status === 'FAILED' &&
                (activeJob.errorMessage ?? 'A importação falhou antes de concluir.')}
            </p>
          </div>
        )}

        {activeJob?.resultSummary && (
          <div className="mt-6 space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Linhas {Number(activeJob.resultSummary.totalRows ?? 0)}</Badge>
              <Badge variant="secondary">Criados {Number(activeJob.resultSummary.created ?? 0)}</Badge>
              <Badge variant="secondary">Atualizados {Number(activeJob.resultSummary.updated ?? 0)}</Badge>
              <Badge variant="secondary">Ignorados {Number(activeJob.resultSummary.skipped ?? 0)}</Badge>
              <Badge variant="secondary">Falhas {Number(activeJob.resultSummary.failed ?? 0)}</Badge>
              <Badge variant="secondary">Estoque {Number(activeJob.resultSummary.inventorySynced ?? 0)}</Badge>
            </div>

            {previewItems.length > 0 && (
              <div className="max-h-[280px] overflow-auto rounded-xl border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-background/60 text-left">
                    <tr>
                      <th className="px-3 py-2">Linha</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((item) => (
                      <tr key={`${item.lineNumber}-${item.name}`} className="border-t border-border/50">
                        <td className="px-3 py-2 text-muted-foreground">{item.lineNumber}</td>
                        <td className="px-3 py-2 font-medium">{item.status}</td>
                        <td className="px-3 py-2">
                          <div>{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[item.type, item.categoryName, item.inventorySynced ? 'Estoque sincronizado' : null]
                              .filter(Boolean)
                              .join(' • ')}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{item.reason ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? 'Enfileirando...' : 'Importar itens'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
