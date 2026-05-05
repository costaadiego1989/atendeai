import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Bot,
  Clock,
  Loader2,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

export interface AbandonmentConfig {
  active: boolean;
  message: string;
  useAiMessage: boolean;
  mode: 'SINGLE' | 'QUEUE';
  maxTouches: number;
  intervalMinutes: number;
}

interface AbandonmentConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AbandonmentConfig;
  onConfigChange: (config: AbandonmentConfig) => void;
  onSave: () => void;
  onGenerateAiMessage: () => void;
  isSaving: boolean;
  isGenerating: boolean;
}

const INTERVAL_PRESETS = [
  { value: '30', label: '30 minutos' },
  { value: '60', label: '1 hora' },
  { value: '180', label: '3 horas' },
  { value: '360', label: '6 horas' },
  { value: '720', label: '12 horas' },
  { value: '1440', label: '24 horas' },
];

export const AbandonmentConfigSheet: React.FC<AbandonmentConfigSheetProps> = ({
  open,
  onOpenChange,
  config,
  onConfigChange,
  onSave,
  onGenerateAiMessage,
  isSaving,
  isGenerating,
}) => {
  const update = (partial: Partial<AbandonmentConfig>) => {
    onConfigChange({ ...config, ...partial });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-primary" />
            Configurar Carrinho Abandonado
          </SheetTitle>
          <SheetDescription>
            Defina como a IA retomará contato com clientes que abandonaram o carrinho.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/40 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Mensagem de Abandono</p>
              <p className="text-xs text-muted-foreground">
                Ativa ou desativa a retomada automática de carrinhos abandonados.
              </p>
            </div>
            <Switch
              checked={config.active}
              onCheckedChange={(checked) => update({ active: checked })}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Mensagem de Retomada</Label>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Usar mensagem gerada pela IA
                </span>
              </div>
              <Switch
                checked={config.useAiMessage}
                onCheckedChange={(checked) => update({ useAiMessage: checked })}
              />
            </div>

            {!config.useAiMessage && (
              <div className="space-y-2">
                <Textarea
                  value={config.message}
                  onChange={(e) => update({ message: e.target.value })}
                  placeholder="Oi {nome}! Vi que você estava montando um pedido conosco 🛒 Posso te ajudar a finalizar?"
                  rows={4}
                  className="resize-none"
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">
                    Use <Badge variant="outline" className="text-[9px] px-1.5 py-0">{'nome'}</Badge> para personalizar com o nome do cliente.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={onGenerateAiMessage}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Gerar com IA
                  </Button>
                </div>
              </div>
            )}

            {config.useAiMessage && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A IA gerará uma mensagem personalizada para cada cliente, usando o contexto do carrinho,
                  os itens abandonados e o tom de voz da sua empresa.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Intervalo entre envios
            </Label>
            <Select
              value={String(config.intervalMinutes)}
              onValueChange={(value) => update({ intervalMinutes: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Tempo mínimo entre cada retomada de contato com o cliente.
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Modo de Retomada</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => update({ mode: 'SINGLE', maxTouches: 1 })}
                className={`rounded-2xl border p-4 text-left transition-all ${config.mode === 'SINGLE'
                  ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border/60 bg-background/40 hover:bg-background/60'
                  }`}
              >
                <p className="text-sm font-semibold text-foreground">Envio único</p>
                <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                  Envia apenas 1 mensagem de retomada por carrinho abandonado.
                </p>
              </button>

              <button
                type="button"
                onClick={() => update({ mode: 'QUEUE', maxTouches: 3 })}
                className={`rounded-2xl border p-4 text-left transition-all ${config.mode === 'QUEUE'
                  ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border/60 bg-background/40 hover:bg-background/60'
                  }`}
              >
                <p className="text-sm font-semibold text-foreground">Mensagem (fila)</p>
                <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                  Envia até {config.maxTouches} mensagens espaçadas pelo intervalo configurado.
                </p>
              </button>
            </div>
          </div>

          {config.mode === 'QUEUE' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Máximo de toques</Label>
                <Badge variant="outline" className="text-xs font-bold">
                  {config.maxTouches}
                </Badge>
              </div>
              <Slider
                value={[config.maxTouches]}
                onValueChange={([value]) => update({ maxTouches: value })}
                min={2}
                max={3}
                step={1}
              />
              <p className="text-[10px] text-muted-foreground">
                Limite de mensagens que serão enviadas por carrinho abandonado.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-amber-400">
                  Cuidado com spam
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O WhatsApp pode <span className="font-semibold text-amber-300">bloquear seu número</span> se
                  você enviar mensagens em excesso. Recomendamos:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  <li>No máximo <span className="font-bold text-foreground">3 toques</span> por carrinho</li>
                  <li>Intervalo mínimo de <span className="font-bold text-foreground">30 minutos</span> entre toques</li>
                  <li>Se o cliente responder "não quero", a mensagem é pausada automaticamente</li>
                </ul>
              </div>
            </div>
          </div>

          {config.intervalMinutes < 60 && config.mode === 'QUEUE' && (
            <div className="flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 px-3 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <p className="text-[10px] font-medium text-destructive">
                Intervalo agressivo: alto risco de bloqueio no WhatsApp.
              </p>
            </div>
          )}

          <Button
            className="w-full"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar configuração'
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
