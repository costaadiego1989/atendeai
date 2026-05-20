import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Pencil } from 'lucide-react';
import type { Automation } from '../types';
import { TRIGGER_LABELS, STEP_LABELS } from '../types';

interface AutomationsListProps {
  automations: Automation[];
  onEdit: (automation: Automation) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, currentlyActive: boolean) => void;
  disabled?: boolean;
}

export function AutomationsList({
  automations,
  onEdit,
  onDelete,
  onToggleActive,
  disabled,
}: AutomationsListProps) {
  if (!automations.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma automação encontrada.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Crie sua primeira automação para automatizar processos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {automations.map((automation) => (
        <div
          key={automation.id}
          className="glass-card flex flex-col gap-3 rounded-xl border border-border/60 p-5 transition-colors hover:bg-muted/30 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-foreground">{automation.name}</p>
              <Badge
                variant={automation.isActive ? 'default' : 'secondary'}
                className={
                  automation.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : ''
                }
              >
                {automation.isActive ? 'Ativa' : 'Inativa'}
              </Badge>
            </div>
            {automation.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {automation.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline" className="text-[10px]">
                {TRIGGER_LABELS[automation.trigger.type] ?? automation.trigger.type}
              </Badge>
              {automation.steps.slice(0, 3).map((step, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {STEP_LABELS[step.type] ?? step.type}
                </Badge>
              ))}
              {automation.steps.length > 3 && (
                <Badge variant="outline" className="text-[10px]">
                  +{automation.steps.length - 3}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={automation.isActive}
              onCheckedChange={() => onToggleActive(automation.id, automation.isActive)}
              disabled={disabled}
              aria-label={`${automation.isActive ? 'Desativar' : 'Ativar'} ${automation.name}`}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(automation)}
              disabled={disabled}
              aria-label={`Editar ${automation.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(automation.id)}
              disabled={disabled}
              className="text-destructive hover:text-destructive"
              aria-label={`Excluir ${automation.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
