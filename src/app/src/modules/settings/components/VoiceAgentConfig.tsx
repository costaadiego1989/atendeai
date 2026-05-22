import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import type { VoiceConfig } from '../services/voice-service';

interface VoiceAgentConfigProps {
  config: VoiceConfig;
  onChange: (partial: Partial<VoiceConfig>) => void;
}

export function VoiceAgentConfig({ config, onChange }: VoiceAgentConfigProps) {
  const persona = config.persona;
  const hours = config.allowedHours;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">
            Persona do Agente
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Define como o agente de voz se apresenta e fala com o cliente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Agente ativo</Label>
              <p className="text-xs text-muted-foreground">Ativa/desativa ligações automáticas.</p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => onChange({ enabled: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>Nome do agente</Label>
            <Input
              value={persona.name}
              onChange={(e) =>
                onChange({ persona: { ...persona, name: e.target.value } })
              }
              placeholder="Ana"
            />
            <p className="text-[10px] text-muted-foreground">
              O nome que o agente usa ao se apresentar na ligação.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tom de voz</Label>
            <Select
              value={persona.tone}
              onValueChange={(v) =>
                onChange({ persona: { ...persona, tone: v as 'friendly' | 'professional' | 'firm' } })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Amigável</SelectItem>
                <SelectItem value="professional">Profissional</SelectItem>
                <SelectItem value="firm">Firme</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Amigável para follow-up, profissional para confirmações, firme para cobrança.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Velocidade da fala</Label>
            <Input
              type="number"
              min="0.5"
              max="2.0"
              step="0.1"
              value={persona.speed ?? 1.0}
              onChange={(e) =>
                onChange({ persona: { ...persona, speed: Number(e.target.value) } })
              }
            />
            <p className="text-[10px] text-muted-foreground">
              1.0 = normal. Menor = mais lento, maior = mais rápido.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Idioma</Label>
            <Input
              value={persona.language ?? 'pt-BR'}
              onChange={(e) =>
                onChange({ persona: { ...persona, language: e.target.value } })
              }
              placeholder="pt-BR"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Horários Permitidos
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Respeite a legislação: ligações de cobrança só em horário comercial.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input
                type="time"
                value={hours.start}
                onChange={(e) =>
                  onChange({ allowedHours: { ...hours, start: e.target.value } })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input
                type="time"
                value={hours.end}
                onChange={(e) =>
                  onChange({ allowedHours: { ...hours, end: e.target.value } })
                }
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Ligações fora desse horário serão adiadas para o próximo dia útil.
          </p>

          {config.twilioPhoneNumber && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Número Twilio configurado:</p>
              <p className="text-sm font-medium text-foreground">{config.twilioPhoneNumber}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
