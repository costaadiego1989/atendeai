import { useState } from 'react';
import { Zap, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useManualAutomations, useTriggerAutomation } from '../hooks/useManualAutomations';
import type { Automation } from '@/modules/automations/types';

interface AutomationPickerButtonProps {
  tenantId: string;
  conversationId: string;
  /** Called after a successful dispatch so the UI can react (e.g. show a toast) */
  onDispatched?: (automation: Automation) => void;
  disabled?: boolean;
}

/**
 * A button that opens a popover listing MANUAL automations for the tenant.
 * Clicking an automation dispatches it in the current conversation context.
 *
 * Only shown to human agents (status === 'PENDING_HUMAN').
 */
export function AutomationPickerButton({
  tenantId,
  conversationId,
  onDispatched,
  disabled = false,
}: AutomationPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: automations = [], isLoading } = useManualAutomations(tenantId);
  const triggerMutation = useTriggerAutomation(tenantId, conversationId);

  const filtered = automations.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (automation: Automation) => {
    triggerMutation.mutate(automation.id, {
      onSuccess: () => {
        setOpen(false);
        setSearch('');
        onDispatched?.(automation);
      },
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-2xl"
          disabled={disabled || triggerMutation.isPending}
          title="Enviar automação"
          aria-label="Selecionar automação para enviar"
        >
          <Zap className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0"
        align="end"
        side="top"
        sideOffset={8}
      >
        <div className="border-b border-border/60 px-3 py-3">
          <p className="text-sm font-semibold">Automações disponíveis</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione uma para disparar agora nesta conversa
          </p>
        </div>

        {automations.length > 4 && (
          <div className="px-3 py-2 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar automação..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        )}

        <ScrollArea className="max-h-64">
          {isLoading ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground animate-pulse">
              Carregando automações...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {search
                ? 'Nenhuma automação encontrada.'
                : 'Nenhuma automação manual configurada. Crie uma no módulo Automações com gatilho "Disparo manual / IA".'}
            </div>
          ) : (
            <div className="py-1">
              {filtered.map((automation) => (
                <button
                  key={automation.id}
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors disabled:opacity-50"
                  onClick={() => handleSelect(automation)}
                  disabled={triggerMutation.isPending}
                  aria-label={`Disparar automação: ${automation.name}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{automation.name}</p>
                    {automation.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {automation.description}
                      </p>
                    )}
                    <Badge variant="outline" className="mt-1 text-xs px-1.5 py-0">
                      {automation.steps.length} {automation.steps.length === 1 ? 'passo' : 'passos'}
                    </Badge>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {triggerMutation.isError && (
          <div className="border-t border-border/60 px-3 py-2">
            <p className="text-xs text-destructive">
              Erro ao disparar automação. Tente novamente.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
