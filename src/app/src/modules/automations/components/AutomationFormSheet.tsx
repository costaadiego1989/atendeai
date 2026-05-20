import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { TriggerType, TRIGGER_LABELS, StepType } from '../types';
import type { Automation, CreateAutomationInput, AutomationStep } from '../types';
import { AutomationStepBuilder } from './AutomationStepBuilder';

const automationSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  triggerType: z.nativeEnum(TriggerType),
  triggerConfig: z.record(z.unknown()).default({}),
});

type FormValues = z.infer<typeof automationSchema>;

interface AutomationFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation?: Automation | null;
  onSubmit: (input: CreateAutomationInput) => Promise<unknown>;
  isSubmitting?: boolean;
}

const TRIGGER_OPTIONS = Object.values(TriggerType).map((type) => ({
  value: type,
  label: TRIGGER_LABELS[type],
}));

export function AutomationFormSheet({
  open,
  onOpenChange,
  automation,
  onSubmit,
  isSubmitting,
}: AutomationFormSheetProps) {
  const isEditing = !!automation;

  const form = useForm<FormValues>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: '',
      description: '',
      triggerType: TriggerType.MESSAGE_RECEIVED,
      triggerConfig: {},
    },
  });

  const [steps, setSteps] = React.useState<Omit<AutomationStep, 'id'>[]>([
    { type: StepType.SEND_MESSAGE, config: { channel: 'whatsapp', body: '' }, order: 0 },
  ]);

  useEffect(() => {
    if (automation) {
      form.reset({
        name: automation.name,
        description: automation.description ?? '',
        triggerType: automation.trigger.type,
        triggerConfig: automation.trigger.config,
      });
      setSteps(
        automation.steps.map((s) => ({
          type: s.type,
          config: s.config,
          order: s.order,
        })),
      );
    } else {
      form.reset({
        name: '',
        description: '',
        triggerType: TriggerType.MESSAGE_RECEIVED,
        triggerConfig: {},
      });
      setSteps([
        { type: StepType.SEND_MESSAGE, config: { channel: 'whatsapp', body: '' }, order: 0 },
      ]);
    }
  }, [automation, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const input: CreateAutomationInput = {
      name: values.name,
      description: values.description || undefined,
      trigger: {
        type: values.triggerType,
        config: values.triggerConfig,
      },
      steps,
    };

    await onSubmit(input);
    onOpenChange(false);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar automação' : 'Nova automação'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Altere os dados da automação.'
              : 'Configure o gatilho e os passos da automação.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="Ex: Boas-vindas ao novo contato"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="O que essa automação faz?"
              {...form.register('description')}
            />
          </div>

          <div className="space-y-2">
            <Label>Gatilho</Label>
            <Controller
              control={form.control}
              name="triggerType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o gatilho" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-[10px] text-muted-foreground">
              A automação será executada quando esse evento ocorrer.
            </p>
          </div>

          <AutomationStepBuilder steps={steps} onChange={setSteps} />

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar automação'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}


