import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookMarked, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
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
import { Badge } from '@/components/ui/badge';
import { recoveryService } from '@/modules/recovery/services/RecoveryService';
import type { RecoveryPageViewModel } from '@/modules/recovery/view-models/useRecoveryPageViewModel';
import { getFriendlyErrorMessage } from '@/shared/api/error-message';

export function RecoveryPlaybooksSheet({ vm }: { vm: RecoveryPageViewModel }) {
  const tenantId = vm.tenant?.id;
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      recoveryService.createPlaybook(tenantId!, {
        name: newName.trim(),
        phases: [
          {
            sortOrder: 0,
            channel: 'WHATSAPP',
            mode: 'AI',
            minDaysOverdue: 0,
            minDelayHoursSincePrevious: 0,
          },
        ],
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['recovery-playbooks', tenantId] });
      await qc.invalidateQueries({ queryKey: ['recovery-cases', tenantId], exact: false });
      setNewName('');
      toast({
        title: 'Playbook criado',
        description:
          'Revise as fases abaixo e clique em Activar para que novos casos usem este roteiro (com RECOVERY_PLAYBOOKS_ENABLED na API).',
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao criar playbook',
        description: getFriendlyErrorMessage(error, {
          fallbackMessage: 'Verifique os dados e tente novamente.',
        }),
        variant: 'destructive',
      });
    },
  });

  const rows = vm.playbooksQuery.data ?? [];

  return (
    <Sheet open={vm.playbooksOpen} onOpenChange={vm.setPlaybooksOpen}>
      <SheetContent side="right" className="flex w-[520px] flex-col overflow-y-auto sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5" />
            Playbooks de cobrança
          </SheetTitle>
          <SheetDescription className="text-left leading-relaxed">
            Um playbook é um <strong>roteiro em fases</strong>: você define quando cada mensagem pode ser enviada (dias em atraso,
            tempo desde o envio anterior) e se o texto vem da <strong>IA</strong> ou de um <strong>modelo</strong> com variáveis.
            Novos casos podem ser ligados ao playbook activo automaticamente quando a API está com{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">RECOVERY_PLAYBOOKS_ENABLED=true</code>.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!tenantId || vm.seedPlaybookMutation.isPending}
            onClick={() => vm.seedPlaybookMutation.mutate()}
          >
            {vm.seedPlaybookMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A preparar…
              </>
            ) : (
              'Garantir playbook padrão'
            )}
          </Button>
        </div>

        <div className="mt-8 space-y-3 rounded-xl border border-border/60 bg-muted/15 p-4">
          <p className="text-sm font-semibold text-foreground">Criar playbook simples</p>
          <p className="text-xs text-muted-foreground">
            Uma primeira fase em modo IA no WhatsApp. Depois pode criar outros playbooks pela API ou expandir este fluxo.
          </p>
          <div className="space-y-2">
            <Label htmlFor="recovery-new-playbook-name">Nome</Label>
            <Input
              id="recovery-new-playbook-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Cobrança amigável — filial centro"
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!tenantId || !newName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando…
              </>
            ) : (
              'Criar playbook'
            )}
          </Button>
        </div>

        <div className="mt-8">
          <p className="text-sm font-semibold text-foreground">Playbooks do tenant</p>
          {vm.playbooksQuery.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">A carregar…</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum playbook ainda. Use &quot;Garantir playbook padrão&quot; para criar o modelo inicial do sistema.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {rows.map((row) => {
                const { playbook, phases } = row;
                const open = expandedId === playbook.id;
                return (
                  <li
                    key={playbook.id}
                    className="rounded-xl border border-border/60 bg-background/40 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{playbook.name}</span>
                          {playbook.active ? (
                            <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Activo</Badge>
                          ) : (
                            <Badge variant="outline">Inactivo</Badge>
                          )}
                          {playbook.isSystem ? (
                            <Badge variant="secondary" className="text-xs">
                              Sistema
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {playbook.branchId ? 'Âmbito: filial específica' : 'Âmbito: toda a empresa'} · {phases.length}{' '}
                          fase(s)
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {!playbook.active ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={vm.activatePlaybookMutation.isPending}
                            onClick={() => vm.activatePlaybookMutation.mutate(playbook.id)}
                          >
                            Activar
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="gap-1"
                          onClick={() => setExpandedId(open ? null : playbook.id)}
                        >
                          {open ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          Fases
                        </Button>
                      </div>
                    </div>
                    {open ? (
                      <ol className="mt-3 space-y-2 border-t border-border/50 pt-3 text-sm">
                        {[...phases]
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((ph, idx) => (
                            <li
                              key={ph.id}
                              className="rounded-lg bg-muted/30 px-3 py-2 text-muted-foreground"
                            >
                              <span className="font-medium text-foreground">
                                {idx + 1}. {ph.mode === 'AI' ? 'IA' : 'Modelo'} · {ph.channel}
                              </span>
                              <span className="mt-1 block text-xs">
                                Atraso mín.: {ph.minDaysOverdue} dia(s) · Intervalo desde fase anterior:{' '}
                                {ph.minDelayHoursSincePrevious} h
                              </span>
                              {ph.mode === 'TEMPLATE' && ph.templateBody ? (
                                <span className="mt-1 block whitespace-pre-wrap text-xs opacity-90">
                                  {ph.templateBody.slice(0, 220)}
                                  {ph.templateBody.length > 220 ? '…' : ''}
                                </span>
                              ) : null}
                            </li>
                          ))}
                      </ol>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
