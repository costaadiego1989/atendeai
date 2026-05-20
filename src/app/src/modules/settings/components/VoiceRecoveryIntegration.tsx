import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhoneCall, AlertTriangle } from 'lucide-react';
import type { VoiceRecoveryConfig } from '../services/voice-service';

interface VoiceRecoveryIntegrationProps {
  recovery: VoiceRecoveryConfig;
  onChange: (recovery: VoiceRecoveryConfig) => void;
}

export function VoiceRecoveryIntegration({ recovery, onChange }: VoiceRecoveryIntegrationProps) {
  const update = (partial: Partial<VoiceRecoveryConfig>) => {
    onChange({ ...recovery, ...partial });
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneCall className="h-4 w-4 text-primary" />
            Cobrança por Voz
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Quando ativado, o agente de voz liga automaticamente para contatos com pagamentos vencidos,
            seguindo a cadência configurada.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Ativar cobrança por voz</Label>
              <p className="text-xs text-muted-foreground">
                Liga automaticamente após X dias de atraso.
              </p>
            </div>
            <Switch
              checked={recovery.enabled}
              onCheckedChange={(v) => update({ enabled: v })}
            />
          </div>

          {recovery.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dias após vencimento</Label>
                  <Input
                    type="number"
                    min="1"
                    max="90"
                    value={recovery.daysAfterDue}
                    onChange={(e) => update({ daysAfterDue: Number(e.target.value) })}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Quantos dias após o vencimento a primeira ligação é feita.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Valor mínimo (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    value={recovery.minAmount}
                    onChange={(e) => update({ minAmount: Number(e.target.value) })}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Não liga para dívidas abaixo desse valor.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tentativas máximas</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={recovery.maxAttempts}
                    onChange={(e) => update({ maxAttempts: Number(e.target.value) })}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Número máximo de ligações por contato.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Intervalo entre tentativas (horas)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="168"
                    value={recovery.intervalHours}
                    onChange={(e) => update({ intervalHours: Number(e.target.value) })}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Tempo mínimo entre uma ligação e outra.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Legislação</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Ligações de cobrança devem respeitar o horário comercial (8h-20h) e
                      não podem ser feitas em feriados. O sistema respeita automaticamente
                      os horários configurados na aba "Agente de Voz".
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
