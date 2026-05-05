import { useMemo, useState } from 'react';
import { Tags, Trash2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ContactStage } from '@/shared/types';

interface ContactsBulkActionsBarProps {
  selectedCount: number;
  busy: boolean;
  stageOptions: Array<{ value: ContactStage | 'ALL'; label: string }>;
  onApplyStage: (stage: ContactStage) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

export function ContactsBulkActionsBar({
  selectedCount,
  busy,
  stageOptions,
  onApplyStage,
  onAddTag,
  onRemoveTag,
  onDelete,
  onClear,
}: ContactsBulkActionsBarProps) {
  const [stage, setStage] = useState<ContactStage | ''>('');
  const [tagInput, setTagInput] = useState('');

  const availableStages = useMemo(
    () => stageOptions.filter((option): option is { value: ContactStage; label: string } => option.value !== 'ALL'),
    [stageOptions],
  );

  if (selectedCount === 0) {
    return null;
  }

  const trimmedTag = tagInput.trim();

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              {selectedCount} selecionados
            </Badge>
            <p className="text-sm text-muted-foreground">
              Atualize estagio, ajuste tags ou remova contatos de uma vez.
            </p>
          </div>

          <Button variant="ghost" size="sm" className="gap-1.5 self-start lg:self-auto" onClick={onClear}>
            <X className="h-4 w-4" />
            Limpar selecao
          </Button>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1fr_1.3fr_auto]">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={stage} onValueChange={(value: ContactStage) => setStage(value)} disabled={busy}>
              <SelectTrigger className="w-full sm:flex-1">
                <SelectValue placeholder="Mover para estagio..." />
              </SelectTrigger>
              <SelectContent>
                {availableStages.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="default"
              variant="outline"
              disabled={busy || !stage}
              onClick={() => {
                if (!stage) {
                  return;
                }

                onApplyStage(stage);
                setStage('');
              }}
            >
              Atualizar
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="Tag para adicionar ou remover..."
                className="pl-9"
                disabled={busy}
              />
            </div>

            <Button
              size="default"
              variant="outline"
              disabled={busy || !trimmedTag}
              onClick={() => {
                if (!trimmedTag) {
                  return;
                }

                onAddTag(trimmedTag);
                setTagInput('');
              }}
            >
              Adicionar tag
            </Button>
            <Button
              size="default"
              variant="outline"
              disabled={busy || !trimmedTag}
              onClick={() => {
                if (!trimmedTag) {
                  return;
                }

                onRemoveTag(trimmedTag);
                setTagInput('');
              }}
            >
              Remover tag
            </Button>
          </div>

          <div className="flex justify-start xl:justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="gap-1.5" disabled={busy}>
                  <Trash2 className="h-4 w-4" />
                  Excluir em lote
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir contatos selecionados?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Vamos remover {selectedCount} contato(s) do CRM. Essa ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Excluir contatos</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
