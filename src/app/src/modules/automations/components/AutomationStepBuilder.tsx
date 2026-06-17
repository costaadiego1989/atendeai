import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { StepType, STEP_LABELS } from '../types';
import type { AutomationStep } from '../types';
import { StepConfigFields } from './StepConfigFields';
import { getDefaultStepConfig } from '../utils/step-defaults';

interface AutomationStepBuilderProps {
  steps: Omit<AutomationStep, 'id'>[];
  onChange: (steps: Omit<AutomationStep, 'id'>[]) => void;
}

const STEP_OPTIONS = Object.values(StepType).map((type) => ({
  value: type,
  label: STEP_LABELS[type],
}));

export function AutomationStepBuilder({ steps, onChange }: AutomationStepBuilderProps) {
  const addStep = () => {
    onChange([
      ...steps,
      { type: StepType.SEND_MESSAGE, config: getDefaultStepConfig(StepType.SEND_MESSAGE), order: steps.length },
    ]);
  };

  const removeStep = (index: number) => {
    const next = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    onChange(next);
  };

  const updateStepType = (index: number, type: StepType) => {
    const next = steps.map((s, i) =>
      i === index ? { ...s, type, config: getDefaultStepConfig(type) } : s,
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
              <SelectTrigger className="flex-1 text-sm">
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
              className="text-destructive hover:text-destructive"
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
