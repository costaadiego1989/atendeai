import { Bot, Loader2, Sparkles, History, MessageSquare, Info, ShieldCheck, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { useModuleAgentRuleViewModel } from '@/modules/agent-rules/view-models/useModuleAgentRuleViewModel';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type Props = {
  vm: ReturnType<typeof useModuleAgentRuleViewModel>;
};

export function ModuleAgentRuleDialog({ vm }: Props) {
  return (
    <Sheet open={vm.open} onOpenChange={vm.setOpen}>
      <SheetContent className="sm:max-w-xl flex flex-col p-0 gap-0">
        <SheetHeader className="p-6 border-b border-border/50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold tracking-tight">
                  Especialidade IA: {vm.moduleLabel}
                </SheetTitle>
                <SheetDescription className="text-sm mt-0.5">
                  Refine o comportamento do agente neste contexto operacional.
                </SheetDescription>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {vm.activeBranchName
                    ? `Escopo atual: filial ${vm.activeBranchName}.`
                    : 'Escopo atual: empresa inteira.'}
                  {vm.inheritedFromTenant
                    ? ' Esta filial ainda esta herdando a regra global do tenant.'
                    : ''}
                </p>
              </div>
            </div>
            {vm.revision > 0 && (
              <div className="shrink-0 flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary uppercase tracking-wider">
                Revisão #{vm.revision}
              </div>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className={cn(
                "flex flex-col justify-between rounded-xl border p-4 transition-all",
                vm.isActive ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"
              )}>
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-foreground">Status da Regra</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Ative para aplicar estas instruções customizadas.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={vm.isActive}
                      onChange={(e) => vm.setIsActive(e.target.checked)}
                    />
                    <div className="peer h-5 w-9 rounded-full bg-muted-foreground/30 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full" />
                  </label>
                </div>
              </div>

              <div className={cn(
                "flex flex-col justify-between rounded-xl border p-4 transition-all",
                vm.fallbackToGlobal ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"
              )}>
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-foreground">Fallback Global</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Manter instruções gerais da empresa ativas.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={vm.fallbackToGlobal}
                      onChange={(e) => vm.setFallbackToGlobal(e.target.checked)}
                    />
                    <div className="peer h-5 w-9 rounded-full bg-muted-foreground/30 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full" />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Instruções Customizadas
                </div>
                <div className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">
                  Markdown Suportado
                </div>
              </div>
              <Textarea
                value={vm.customPrompt}
                onChange={(e) => vm.setCustomPrompt(e.target.value)}
                placeholder={vm.placeholder}
                maxLength={vm.promptMaxLength}
                className="min-h-[160px] resize-none rounded-xl border-border/50 bg-background/50 p-4 text-sm ring-offset-background focus:ring-1 focus:ring-primary/20"
              />

              <div className="flex items-center justify-between px-1">
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Guardrails Ativos
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    {vm.customPrompt.length} / {vm.promptMaxLength}
                  </div>
                </div>
                {vm.updatedAt && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground italic">
                    Editado por {vm.updatedByUserName || 'Sistema'} em {format(new Date(vm.updatedAt), 'dd/MM/yy HH:mm')}
                  </div>
                )}
              </div>
            </div>

            {vm.trainingExamples?.length ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-background/45 p-4">
                <div>
                  <p className="text-sm font-bold text-foreground">Training Hub rápido</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Comece com um comportamento aprovado e ajuste no campo acima.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {vm.trainingExamples.map((example) => (
                    <button
                      key={example.title}
                      type="button"
                      className="rounded-xl border border-border/60 bg-muted/10 p-3 text-left transition hover:border-primary/30 hover:bg-primary/5"
                      onClick={() => vm.applyTrainingExample(example.prompt)}
                    >
                      <p className="text-xs font-semibold text-foreground">{example.title}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                        {example.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <ClipboardList className="h-4 w-4 text-primary" />
                Notas Internas (Auditoria)
              </div>
              <Textarea
                value={vm.notes}
                onChange={(e) => vm.setNotes(e.target.value)}
                placeholder="Descreva o motivo desta alteração para futuras revisões..."
                maxLength={vm.notesMaxLength}
                className="min-h-[60px] resize-none rounded-xl border-border/40 bg-muted/10 p-3 text-xs italic"
              />
              <p className="text-[10px] text-muted-foreground">
                {vm.notes.length} / {vm.notesMaxLength} caracteres (auditoria interna).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => vm.runPreview()}
                disabled={!vm.canPublish || vm.isPreviewing}
              >
                {vm.isPreviewing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Pré-visualizar revisão
              </Button>
            </div>

            {vm.previewSnapshot ? (
              <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Impacto da próxima revisão
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Revisão atual guardada: #{vm.previewSnapshot.currentStoredRevision}. Ao publicar,
                  passará para #{vm.previewSnapshot.wouldBeRevision}.
                </p>
                <div className="rounded-xl border border-border/50 bg-background/60 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {vm.previewSnapshot.normalizedCustomPrompt || '(texto vazio após normalização)'}
                </div>
                {vm.previewSnapshot.notesTrimmed ? (
                  <p className="text-[11px] text-muted-foreground">
                    Notas normalizadas: {vm.previewSnapshot.notesTrimmed}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <History className="h-4 w-4 text-primary" />
                Histórico de revisões
              </div>
              {vm.historyLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : vm.historyEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma revisão anterior registada para este escopo.
                </p>
              ) : (
                <div className="max-h-44 overflow-y-auto rounded-xl border border-border/60 bg-muted/10">
                  <ul className="space-y-2 p-3">
                    {vm.historyEntries.map((entry) => (
                      <li
                        key={`${entry.revision}-${entry.createdAt}`}
                        className="rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-left"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-foreground">
                            Revisão #{entry.revision}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(entry.createdAt), 'dd/MM/yy HH:mm')}
                            {entry.updatedByUserName ? ` · ${entry.updatedByUserName}` : ''}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                          {entry.customPrompt || '(sem texto)'}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="border-t border-border/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Dando vida ao seu AtendeAí
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => vm.setOpen(false)} className="px-4 text-sm font-medium">
              Sair sem salvar
            </Button>
            <Button
              onClick={vm.save}
              className="px-6 text-sm font-bold"
              disabled={vm.isSaving || !vm.canPublish}
            >
              {vm.isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Publicar Revisão
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
