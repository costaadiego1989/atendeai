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
import { Textarea } from '@/components/ui/textarea';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { StepType, STEP_LABELS } from '../types';
import type { AutomationStep } from '../types';

interface AutomationStepBuilderProps {
  steps: Omit<AutomationStep, 'id'>[];
  onChange: (steps: Omit<AutomationStep, 'id'>[]) => void;
}

const STEP_OPTIONS = Object.values(StepType).map((type) => ({
  value: type,
  label: STEP_LABELS[type],
}));

function getDefaultConfig(type: StepType): Record<string, unknown> {
  switch (type) {
    case StepType.SEND_MESSAGE:
      return { channel: 'whatsapp', body: '' };
    case StepType.WAIT_DELAY:
      return { delayHuman: '1h', delayMs: 3600000 };
    case StepType.CONDITION_BRANCH:
      return { field: '', operator: 'equals', value: '' };
    case StepType.HTTP_REQUEST:
      return { method: 'POST', url: '', headers: {}, body: {} };
    case StepType.UPDATE_CONTACT:
      return { fields: {} };
    case StepType.ADD_TAG:
    case StepType.REMOVE_TAG:
      return { tag: '' };
    case StepType.ASSIGN_AGENT:
      return { userId: '' };
    case StepType.AI_RESPONSE:
      return {};
    case StepType.CREATE_TASK:
      return { title: '', dueInHours: 24 };
    default:
      return {};
  }
}

function StepConfigFields({
  step,
  onConfigChange,
}: {
  step: Omit<AutomationStep, 'id'>;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const config = step.config;

  switch (step.type) {
    case StepType.SEND_MESSAGE:
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Canal</Label>
            <Select
              value={(config.channel as string) || 'whatsapp'}
              onValueChange={(v) => onConfigChange({ ...config, channel: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="web_chat">Web Chat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              rows={2}
              className="text-xs"
              placeholder="Olá {nome}, tudo bem?"
              value={(config.body as string) || ''}
              onChange={(e) => onConfigChange({ ...config, body: e.target.value })}
            />
          </div>
        </div>
      );

    case StepType.WAIT_DELAY:
      return (
        <div className="space-y-1">
          <Label className="text-xs">Tempo de espera</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Ex: 5m, 1h, 2d"
            value={(config.delayHuman as string) || ''}
            onChange={(e) => onConfigChange({ ...config, delayHuman: e.target.value })}
          />
          <p className="text-[10px] text-muted-foreground">
            Use m (minutos), h (horas), d (dias)
          </p>
        </div>
      );

    case StepType.ADD_TAG:
    case StepType.REMOVE_TAG:
      return (
        <div className="space-y-1">
          <Label className="text-xs">Tag</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Nome da tag"
            value={(config.tag as string) || ''}
            onChange={(e) => onConfigChange({ ...config, tag: e.target.value })}
          />
        </div>
      );

    case StepType.ASSIGN_AGENT:
      return (
        <div className="space-y-1">
          <Label className="text-xs">ID do agente</Label>
          <Input
            className="h-8 text-xs"
            placeholder="UUID do usuário"
            value={(config.userId as string) || ''}
            onChange={(e) => onConfigChange({ ...config, userId: e.target.value })}
          />
        </div>
      );

    case StepType.CREATE_TASK:
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Título da tarefa</Label>
            <Input
              className="h-8 text-xs"
              placeholder="Ligar para o contato"
              value={(config.title as string) || ''}
              onChange={(e) => onConfigChange({ ...config, title: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Prazo (horas)</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              value={(config.dueInHours as number) || 24}
              onChange={(e) =>
                onConfigChange({ ...config, dueInHours: Number(e.target.value) })
              }
            />
          </div>
        </div>
      );

    default:
      return (
        <p className="text-[10px] text-muted-foreground">
          Configuração avançada disponível em breve.
        </p>
      );
  }
}

export function AutomationStepBuilder({ steps, onChange }: AutomationStepBuilderProps) {
  const addStep = () => {
    onChange([
      ...steps,
      { type: StepType.SEND_MESSAGE, config: getDefaultConfig(StepType.SEND_MESSAGE), order: steps.length },
    ]);
  };

  const removeStep = (index: number) => {
    const next = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    onChange(next);
  };

  const updateStepType = (index: number, type: StepType) => {
    const next = steps.map((s, i) =>
      i === index ? { ...s, type, config: getDefaultConfig(type) } : s,
    );
    onChange(next);
  };

  const updateStepConfig = (index: number, config: Record<string, unknown>) => {
    const next = steps.map((s, i) => (i === index ? { ...s, config } : s));
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Passos</Label>
        <Button type="button" variant="outline" size="sm" onClick={addStep} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Adicionar passo
        </Button>
      </div>

      {steps.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Adicione pelo menos um passo para a automação.
        </p>
      )}

      {steps.map((step, index) => (
        <div
          key={index}
          className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
            <span className="text-[10px] font-bold text-muted-foreground">
              #{index + 1}
            </span>
            <Select
              value={step.type}
              onValueChange={(v) => updateStepType(index, v as StepType)}
            >
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => removeStep(index)}
              aria-label={`Remover passo ${index + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <StepConfigFields
            step={step}
            onConfigChange={(config) => updateStepConfig(index, config)}
          />
        </div>
      ))}
    </div>
  );
}
