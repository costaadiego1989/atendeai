import { useRef, type ChangeEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { downloadContactsImportTemplate } from '@/shared/lib/import-templates';
import { TagInput } from '@/shared/ui/TagInput';
import type { ContactAsyncJob, ContactImportResult, ContactStage } from '@/shared/types';

interface ImportContactsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    rawText: string;
    defaultStage: ContactStage;
    defaultTags: string;
  };
  previewCount: number;
  result: ContactImportResult | null;
  activeJob?: ContactAsyncJob | null;
  isPending: boolean;
  onFormChange: <K extends 'rawText' | 'defaultStage' | 'defaultTags'>(
    field: K,
    value: K extends 'defaultStage' ? ContactStage : string,
  ) => void;
  onSubmit: () => void;
}

export function ImportContactsSheet({
  open,
  onOpenChange,
  form,
  previewCount,
  result,
  activeJob,
  isPending,
  onFormChange,
  onSubmit,
}: ImportContactsSheetProps) {
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

  const previewItems = Array.isArray(result?.items)
    ? result.items
    : Array.isArray(activeJob?.resultSummary?.previewItems)
      ? activeJob.resultSummary.previewItems
      : Array.isArray((activeJob?.resultSummary as { items?: ContactImportResult['items'] } | undefined)?.items)
        ? (activeJob?.resultSummary as { items: ContactImportResult['items'] }).items
        : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[760px] overflow-y-auto sm:max-w-[760px]">
        <SheetHeader>
          <SheetTitle>Importar lista de contatos</SheetTitle>
          <SheetDescription>
            Importe por arquivo `.csv` ou `.txt`, ou cole uma lista com uma linha por contato.
            <span className="mt-2 block font-mono text-xs text-foreground/80">
              Nome; Telefone; Documento; Email; Tags; Observações
            </span>
            <span className="mt-2 block text-xs text-muted-foreground">
              Para bases grandes, prefira baixar o modelo oficial, preencher e subir no mesmo formato.
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Estagio padrao</Label>
            <Select
              value={form.defaultStage}
              onValueChange={(value) => onFormChange('defaultStage', value as ContactStage)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LEAD">Lead</SelectItem>
                <SelectItem value="PROSPECT">Prospect</SelectItem>
                <SelectItem value="OPPORTUNITY">Oportunidade</SelectItem>
                <SelectItem value="CUSTOMER">Cliente</SelectItem>
                <SelectItem value="INACTIVE">Inativo</SelectItem>
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
                Cole uma base pronta, baixe o modelo oficial ou carregue um arquivo para preencher o campo abaixo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 px-4"
                onClick={downloadContactsImportTemplate}
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
            placeholder={`Maria da Silva; +55 21 99999-0001; 12345678901; maria@email.com; vip|quente; Prefere contato após 14h\nJoao Pereira; +55 21 99999-0002`}
          />
          <p className="text-xs text-muted-foreground">
            {previewCount} linhas detectadas. Se vier só o telefone, geramos um nome provisório.
          </p>
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
                'A lista esta sendo processada em segundo plano. O CRM sera atualizado quando terminar.'}
              {activeJob.status === 'COMPLETED' &&
                'Importação concluida. Abaixo mostramos o resumo e as principais linhas com atenção.'}
              {activeJob.status === 'FAILED' &&
                (activeJob.errorMessage ?? 'A importação falhou antes de concluir.')}
            </p>
          </div>
        )}

        {(result || activeJob?.resultSummary) && (
          <div className="mt-6 space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                Linhas {result?.totalRows ?? Number(activeJob?.resultSummary?.totalRows ?? 0)}
              </Badge>
              <Badge variant="secondary">
                Criados {result?.created ?? Number(activeJob?.resultSummary?.created ?? 0)}
              </Badge>
              <Badge variant="secondary">
                Atualizados {result?.updated ?? Number(activeJob?.resultSummary?.updated ?? 0)}
              </Badge>
              <Badge variant="secondary">
                Ignorados {result?.skipped ?? Number(activeJob?.resultSummary?.skipped ?? 0)}
              </Badge>
              <Badge variant="secondary">
                Falhas {result?.failed ?? Number(activeJob?.resultSummary?.failed ?? 0)}
              </Badge>
            </div>

            {previewItems.length > 0 && (
              <div className="max-h-[280px] overflow-auto rounded-xl border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-background/60 text-left">
                    <tr>
                      <th className="px-3 py-2">Linha</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Contato</th>
                      <th className="px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((item) => (
                      <tr
                        key={`${item.lineNumber}-${item.phone}`}
                        className="border-t border-border/50"
                      >
                        <td className="px-3 py-2 text-muted-foreground">{item.lineNumber}</td>
                        <td className="px-3 py-2 font-medium">{item.status}</td>
                        <td className="px-3 py-2">
                          <div>{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.phone}</div>
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
            {isPending ? 'Enfileirando...' : 'Importar contatos'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
