import { useId, useState } from 'react';
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
import { StepType } from '../types';
import type { AutomationStep } from '../types';

interface StepConfigFieldsProps {
  step: Omit<AutomationStep, 'id'>;
  onConfigChange: (config: Record<string, unknown>) => void;
}

const CONDITION_OPERATORS: { value: string; label: string }[] = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'contains', label: 'Contém' },
  { value: 'gt', label: 'Maior que' },
  { value: 'lt', label: 'Menor que' },
  { value: 'exists', label: 'Existe' },
];

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Controlled editor for an object stored as a JSON record. Keeps the raw text
 *  while the user types and only propagates a parsed object when it is valid. */
function JsonField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: Record<string, unknown> | unknown;
  placeholder?: string;
  onChange: (parsed: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(() =>
    value && Object.keys(value as object).length > 0
      ? JSON.stringify(value, null, 2)
      : '',
  );
  const [error, setError] = useState(false);

  const handleChange = (raw: string) => {
    setText(raw);
    if (raw.trim() === '') {
      setError(false);
      onChange({});
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      setError(false);
      onChange(parsed);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea
        rows={3}
        className="font-mono text-xs"
        placeholder={placeholder}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
      />
      {error && (
        <p className="text-[10px] text-destructive">JSON inválido</p>
      )}
    </div>
  );
}

/**
 * Renders the configuration form for a single automation step.
 * Single source of truth shared by the step builder and the wizard so every
 * step type is fully configurable in both places (DRY).
 */
export function StepConfigFields({ step, onConfigChange }: StepConfigFieldsProps) {
  const config = step.config;
  const dueId = useId();
  const set = (patch: Record<string, unknown>) =>
    onConfigChange({ ...config, ...patch });

  switch (step.type) {
    case StepType.SEND_MESSAGE:
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Canal</Label>
            <Select
              value={(config.channel as string) || 'whatsapp'}
              onValueChange={(v) => set({ channel: v })}
            >
              <SelectTrigger className="text-sm">
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
              placeholder="Olá {{nome}}, tudo bem?"
              value={(config.body as string) || ''}
              onChange={(e) => set({ body: e.target.value })}
            />
          </div>
        </div>
      );

    case StepType.WAIT_DELAY:
      return (
        <div className="space-y-1">
          <Label className="text-xs">Tempo de espera</Label>
          <Input
            className="text-sm"
            placeholder="Ex: 5m, 1h, 2d"
            value={(config.delayHuman as string) || ''}
            onChange={(e) => set({ delayHuman: e.target.value })}
          />
          <p className="text-[10px] text-muted-foreground">
            Use m (minutos), h (horas), d (dias)
          </p>
        </div>
      );

    case StepType.CONDITION_BRANCH:
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Campo</Label>
            <Input
              className="text-sm"
              placeholder="Nome do campo (ex: status)"
              value={(config.field as string) || ''}
              onChange={(e) => set({ field: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Operador</Label>
              <Select
                value={(config.operator as string) || 'equals'}
                onValueChange={(v) => set({ operator: v })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(config.operator as string) !== 'exists' && (
              <div className="space-y-1">
                <Label className="text-xs">Valor</Label>
                <Input
                  className="text-sm"
                  placeholder="Valor esperado"
                  value={(config.value as string) ?? ''}
                  onChange={(e) => set({ value: e.target.value })}
                />
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Se verdadeiro segue para o próximo passo; senão a execução é encerrada.
          </p>
        </div>
      );

    case StepType.HTTP_REQUEST:
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Método</Label>
              <Select
                value={(config.method as string) || 'POST'}
                onValueChange={(v) => set({ method: v })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL</Label>
              <Input
                className="text-sm"
                placeholder="https://api.exemplo.com/webhook"
                value={(config.url as string) || ''}
                onChange={(e) => set({ url: e.target.value })}
              />
            </div>
          </div>
          <JsonField
            label="Cabeçalhos (JSON)"
            value={config.headers}
            placeholder='{ "Authorization": "Bearer ..." }'
            onChange={(headers) => set({ headers })}
          />
          <JsonField
            label="Corpo (JSON)"
            value={config.body}
            placeholder='{ "contato": "{{nome}}" }'
            onChange={(body) => set({ body })}
          />
        </div>
      );

    case StepType.UPDATE_CONTACT:
      return (
        <JsonField
          label="Campos a atualizar (JSON)"
          value={config.fields}
          placeholder='{ "stage": "lead", "score": 10 }'
          onChange={(fields) => set({ fields })}
        />
      );

    case StepType.ADD_TAG:
    case StepType.REMOVE_TAG:
      return (
        <div className="space-y-1">
          <Label className="text-xs">Tag</Label>
          <Input
            className="text-sm"
            placeholder="Nome da tag"
            value={(config.tag as string) || ''}
            onChange={(e) => set({ tag: e.target.value })}
          />
        </div>
      );

    case StepType.ASSIGN_AGENT:
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">ID do agente</Label>
            <Input
              className="text-sm"
              placeholder="UUID do agente"
              value={(config.agentId as string) || ''}
              onChange={(e) => set({ agentId: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ID da equipe</Label>
            <Input
              className="text-sm"
              placeholder="UUID da equipe (opcional)"
              value={(config.teamId as string) || ''}
              onChange={(e) => set({ teamId: e.target.value })}
            />
          </div>
        </div>
      );

    case StepType.AI_RESPONSE:
      return (
        <div className="space-y-1">
          <Label className="text-xs">Instruções para a IA</Label>
          <Textarea
            rows={2}
            className="text-xs"
            placeholder="Prompt / instruções (ex: responda educadamente em PT-BR)"
            value={(config.prompt as string) || ''}
            onChange={(e) => set({ prompt: e.target.value })}
          />
        </div>
      );

    case StepType.CREATE_TASK:
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Título da tarefa</Label>
            <Input
              className="text-sm"
              placeholder="Ligar para o contato"
              value={(config.title as string) || ''}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor={dueId}>
              Prazo (horas)
            </Label>
            <Input
              id={dueId}
              type="number"
              min={1}
              className="text-sm"
              value={Math.max(1, Math.round(Number(config.dueInMs ?? 86400000) / 3600000))}
              onChange={(e) =>
                set({ dueInMs: Math.max(1, Number(e.target.value)) * 3600000 })
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
