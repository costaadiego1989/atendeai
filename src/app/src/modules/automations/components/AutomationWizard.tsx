import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckCircle,
  Zap,
  Users,
  Tag,
  AlertCircle,
  Lightbulb,
  BookOpen,
  ArrowRight,
  X,
  Plus,
  FileText,
} from 'lucide-react';
import { TriggerType, StepType, TRIGGER_LABELS, STEP_LABELS } from '../types';
import type { Automation, CreateAutomationInput, AutomationStep } from '../types';
import { automationTemplates } from '../templates/automation-templates';
import type { AutomationTemplate } from '../templates/automation-templates';
import { z } from 'zod';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<WizardStepProps>;
  validation?: (data: any) => boolean;
  help?: string;
}

interface WizardStepProps {
  data: any;
  onChange: (data: any) => void;
  errors?: any;
}

interface AutomationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (automation: CreateAutomationInput) => void;
  onCancel: () => void;
  template?: AutomationTemplate;
}

const automationSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  triggerType: z.nativeEnum(TriggerType),
  triggerConfig: z.record(z.unknown()).default({}),
  steps: z.array(z.object({
    type: z.nativeEnum(StepType),
    config: z.record(z.unknown()),
    order: z.number(),
  })).min(1, 'Adicione pelo menos um passo'),
});

type FormValues = z.infer<typeof automationSchema>;

function BasicInfoStep({ data, onChange, errors }: WizardStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Nome da automação</label>
        <Input
          placeholder="Ex: Boas-vindas ao novo contato"
          value={data.name || ''}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Descrição</label>
        <Textarea
          placeholder="O que essa automação faz?"
          rows={3}
          value={data.description || ''}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
        />
      </div>

      <div className="bg-muted/50 border border-border/60 rounded-lg p-3">
        <div className="flex gap-2">
          <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Dica de nomenclatura</p>
            <p>Use nomes claros e descritivos. Ex: "Boas-vindas novos clientes", "Lembrete pagamento vencido"</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TriggerStep({ data, onChange, errors }: WizardStepProps) {
  const triggerOptions = Object.values(TriggerType).map(type => ({
    value: type,
    label: TRIGGER_LABELS[type],
    description: getTriggerDescription(type),
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Quando a automação deve ser executada?</label>
        <Select
          value={data.triggerType || ''}
          onValueChange={(value) => onChange({ 
            ...data, 
            triggerType: value as TriggerType,
            triggerConfig: getTriggerConfig(value as TriggerType)
          })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o gatilho" />
          </SelectTrigger>
          <SelectContent>
            {triggerOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{opt.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {getTriggerDifficulty(opt.value)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.triggerType && (
          <p className="text-xs text-destructive">{errors.triggerType.message}</p>
        )}
      </div>

      {data.triggerType && (
        <div className="bg-muted/50 border border-border/60 rounded-lg p-3">
          <div className="flex gap-2">
            <BookOpen className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Como funciona este gatilho?</p>
              <p>{getTriggerHelp(data.triggerType)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepsStep({ data, onChange, errors }: WizardStepProps) {
  const [steps, setSteps] = React.useState(data.steps || []);

  useEffect(() => {
    onChange({ ...data, steps });
  }, [steps, onChange, data]);

  const addStep = (type: StepType) => {
    const newStep = {
      type,
      config: getDefaultStepConfig(type),
      order: steps.length,
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    setSteps(newSteps);
  };

  const updateStepConfig = (index: number, config: Record<string, unknown>) => {
    const newSteps = steps.map((step, i) => 
      i === index ? { ...step, config } : step
    );
    setSteps(newSteps);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Quais ações a automação deve executar?</label>
        <p className="text-xs text-muted-foreground">Adicione passos na ordem desejada</p>
      </div>

      {steps.map((step, index) => (
        <div key={index} className="border border-border/60 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Passo {index + 1}</span>
              <Select
                value={step.type}
                onValueChange={(value) => {
                  const newStep = { ...step, type: value as StepType, config: getDefaultStepConfig(value as StepType) };
                  const newSteps = [...steps];
                  newSteps[index] = newStep;
                  setSteps(newSteps);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(StepType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {STEP_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeStep(index)}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <StepConfigFields
            step={step}
            onConfigChange={(config) => updateStepConfig(index, config)}
          />
        </div>
      ))}

      <div className="border-2 border-dashed border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground mb-2">Adicionar novo passo</p>
        <div className="flex gap-2 flex-wrap">
          {Object.values(StepType).map((type) => (
            <Button
              key={type}
              variant="outline"
              size="sm"
              onClick={() => addStep(type)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {STEP_LABELS[type]}
            </Button>
          ))}
        </div>
      </div>

      {errors.steps && (
        <p className="text-xs text-destructive">{errors.steps.message}</p>
      )}
    </div>
  );
}

function StepConfigFields({ step, onConfigChange }: { step: any; onConfigChange: (config: any) => void }) {
  switch (step.type) {
    case StepType.SEND_MESSAGE:
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs">Mensagem</label>
            <Textarea
              rows={2}
              placeholder="Ex: Olá {nome}, tudo bem?"
              value={step.config.body || ''}
              onChange={(e) => onConfigChange({ ...step.config, body: e.target.value })}
            />
          </div>
        </div>
      );

    case StepType.WAIT_DELAY:
      return (
        <div className="space-y-1">
          <label className="text-xs">Tempo de espera</label>
          <Input
            placeholder="Ex: 5m, 1h, 2d"
            value={step.config.delayHuman || ''}
            onChange={(e) => onConfigChange({ ...step.config, delayHuman: e.target.value })}
          />
          <p className="text-[10px] text-muted-foreground">Use m (minutos), h (horas), d (dias)</p>
        </div>
      );

    case StepType.ADD_TAG:
    case StepType.REMOVE_TAG:
      return (
        <div className="space-y-1">
          <label className="text-xs">Tag</label>
          <Input
            placeholder="Nome da tag"
            value={step.config.tag || ''}
            onChange={(e) => onConfigChange({ ...step.config, tag: e.target.value })}
          />
        </div>
      );

    default:
      return (
        <p className="text-xs text-muted-foreground">
          Configuração avançada disponível em breve.
        </p>
      );
  }
}

function getDefaultStepConfig(type: StepType): Record<string, unknown> {
  switch (type) {
    case StepType.SEND_MESSAGE:
      return { channel: 'whatsapp', body: '' };
    case StepType.WAIT_DELAY:
      return { delayHuman: '1h', delayMs: 3600000 };
    case StepType.ADD_TAG:
    case StepType.REMOVE_TAG:
      return { tag: '' };
    default:
      return {};
  }
}

function getTriggerDescription(type: TriggerType): string {
  const descriptions = {
    [TriggerType.CONTACT_CREATED]: 'Quando um novo contato é criado no CRM',
    [TriggerType.TAG_ADDED]: 'Quando uma tag é adicionada a um contato',
    [TriggerType.MESSAGE_RECEIVED]: 'Quando uma mensagem é recebida',
    [TriggerType.PAYMENT_OVERDUE]: 'Quando um pagamento fica vencido',
    [TriggerType.APPOINTMENT_CONFIRMED]: 'Quando um agendamento é confirmado',
    [TriggerType.APPOINTMENT_REMINDER]: 'Quando é hora de um lembrete de agendamento',
    [TriggerType.ORDER_PLACED]: 'Quando um pedido é realizado',
    [TriggerType.CART_ABANDONED]: 'Quando um cliente abandona o carrinho',
    [TriggerType.WEBHOOK_RECEIVED]: 'Quando um webhook é recebido',
    [TriggerType.SCHEDULED]: 'Executado em horário agendado (cron)',
  };
  return descriptions[type] || '';
}

function getTriggerDifficulty(type: TriggerType): string {
  const difficulties = {
    [TriggerType.CONTACT_CREATED]: 'Fácil',
    [TriggerType.TAG_ADDED]: 'Fácil',
    [TriggerType.MESSAGE_RECEIVED]: 'Fácil',
    [TriggerType.PAYMENT_OVERDUE]: 'Médio',
    [TriggerType.APPOINTMENT_CONFIRMED]: 'Médio',
    [TriggerType.APPOINTMENT_REMINDER]: 'Médio',
    [TriggerType.ORDER_PLACED]: 'Médio',
    [TriggerType.CART_ABANDONED]: 'Avançado',
    [TriggerType.WEBHOOK_RECEIVED]: 'Avançado',
    [TriggerType.SCHEDULED]: 'Avançado',
  };
  return difficulties[type] || '';
}

function getTriggerHelp(type: TriggerType): string {
  const helps = {
    [TriggerType.CONTACT_CREATED]: 'Acionado automaticamente quando um novo contato é adicionado ao sistema. Ideal para boas-vindas.',
    [TriggerType.TAG_ADDED]: 'Disparado quando uma tag específica é adicionada a um contato. Útil para segmentação.',
    [TriggerType.MESSAGE_RECEIVED]: 'Acionado quando qualquer mensagem é recebida. Pode ser filtrada por canal.',
    [TriggerType.PAYMENT_OVERDUE]: 'Disparado quando pagamentos não são realizados no prazo. Ideal para cobranças.',
    [TriggerType.SCHEDULED]: 'Executa em horários específicos usando sintaxe cron. Re configuração avançada.',
  };
  return helps[type] || '';
}

function getTriggerConfig(type: TriggerType): Record<string, unknown> {
  switch (type) {
    case TriggerType.CONTACT_CREATED:
      return {};
    case TriggerType.MESSAGE_RECEIVED:
      return { channel: 'whatsapp' };
    case TriggerType.SCHEDULED:
      return { cron: '0 9 * * *' };
    default:
      return {};
  }
}

const wizardSteps: WizardStep[] = [
  {
    id: 'basic-info',
    title: 'Informações Básicas',
    description: 'Nome e descrição da automação',
    icon: FileText,
    component: BasicInfoStep,
    validation: (data) => data.name && data.name.length >= 2,
  },
  {
    id: 'trigger',
    title: 'Gatilho',
    description: 'Quando a automação deve ser executada',
    icon: Zap,
    component: TriggerStep,
    validation: (data) => data.triggerType,
  },
  {
    id: 'steps',
    title: 'Passos',
    description: 'Ações que a automação executará',
    icon: ArrowRight,
    component: StepsStep,
    validation: (data) => data.steps && data.steps.length > 0,
  },
];

export function AutomationWizard({
  open,
  onOpenChange,
  onComplete,
  onCancel,
  template,
}: AutomationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<Partial<FormValues>>({});

  const form = useForm<FormValues>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: '',
      description: '',
      triggerType: TriggerType.MESSAGE_RECEIVED,
      triggerConfig: {},
      steps: [],
    },
  });

  // Carregar template se fornecido
  useEffect(() => {
    if (template && open) {
      const filteredSteps = (template.automation.steps || []).filter((step) => step.type);
      setWizardData({
        name: template.automation.name || '',
        description: template.automation.description || '',
        triggerType: template.automation.trigger?.type || TriggerType.MESSAGE_RECEIVED,
        triggerConfig: template.automation.trigger?.config || {},
        steps: filteredSteps as Omit<AutomationStep, 'id'>[],
      });
      form.reset({
        name: template.automation.name || '',
        description: template.automation.description || '',
        triggerType: template.automation.trigger?.type || TriggerType.MESSAGE_RECEIVED,
        triggerConfig: template.automation.trigger?.config || {},
        steps: filteredSteps as Omit<AutomationStep, 'id'>[],
      });
    }
  }, [template, open, form]);

  const handleNext = () => {
    if (currentStep < wizardSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      const validSteps = (wizardData.steps || []).filter((step) => step.type) as Omit<AutomationStep, 'id'>[];
      // Converter para CreateAutomationInput
      const automationInput: CreateAutomationInput = {
        name: wizardData.name || '',
        description: wizardData.description,
        trigger: {
          type: wizardData.triggerType!,
          config: wizardData.triggerConfig!,
        },
        steps: validSteps,
      };
      onComplete(automationInput);
      onOpenChange(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = wizardSteps[currentStep].validation?.(wizardData) ?? true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Criar Automação
          </DialogTitle>
          <DialogDescription>
            Siga os passos para criar sua automação passo a passo
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 -mx-1 space-y-6">
        {/* Templates selection */}
        {!template && currentStep === 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Ou comece com um template</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {automationTemplates.map((t) => (
                <Card 
                  key={t.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setWizardData({
                      name: t.automation.name || '',
                      description: t.automation.description || '',
                      triggerType: t.automation.trigger?.type || TriggerType.MESSAGE_RECEIVED,
                      triggerConfig: t.automation.trigger?.config || {},
                      steps: t.automation.steps || [],
                    });
                    form.reset({
                      name: t.automation.name || '',
                      description: t.automation.description || '',
                      triggerType: t.automation.trigger?.type || TriggerType.MESSAGE_RECEIVED,
                      triggerConfig: t.automation.trigger?.config || {},
                      steps: t.automation.steps || [],
                    });
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <t.icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{t.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {t.difficulty}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t.estimatedTime}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {t.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Wizard progress */}
        <div className="flex items-center">
          {wizardSteps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center ${index < wizardSteps.length - 1 ? 'flex-1' : ''}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                  index === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : index < currentStep
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < wizardSteps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {wizardSteps[currentStep]?.component && (
          <div className="py-1">
            {React.createElement(wizardSteps[currentStep].component, {
              data: wizardData,
              onChange: setWizardData,
              errors: form.formState.errors,
            })}
          </div>
        )}

        {/* Help section */}
        {wizardSteps[currentStep].help && (
          <div className="bg-muted/50 border border-border/60 rounded-lg p-3">
            <div className="flex gap-2">
              <BookOpen className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Dica</p>
                <p>{wizardSteps[currentStep].help}</p>
              </div>
            </div>
          </div>
        )}
        </div>

        <DialogFooter className="flex justify-between border-t border-border/60 pt-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 0}>
              Anterior
            </Button>
          </div>
          <Button onClick={handleNext} disabled={!canProceed}>
            {currentStep === wizardSteps.length - 1 ? 'Criar automação' : 'Próximo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}