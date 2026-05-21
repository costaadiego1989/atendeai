import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, FileText, Sparkles } from 'lucide-react';
import type { VoiceScript } from '../services/voice-service';
import { voiceService } from '../services/voice-service';
import { toast } from '@/components/ui/use-toast';

interface VoiceScriptsEditorProps {
  scripts: VoiceScript[];
  onChange: (scripts: VoiceScript[]) => void;
  activeScriptName?: string | null;
  onActiveScriptChange: (name: string | null) => void;
  tenantId: string;
}

const SCRIPT_TYPES = [
  { value: 'recovery', label: 'Cobrança' },
  { value: 'confirmation', label: 'Confirmação' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'custom', label: 'Personalizado' },
];

export function VoiceScriptsEditor({
  scripts,
  onChange,
  activeScriptName,
  onActiveScriptChange,
  tenantId,
}: VoiceScriptsEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    scripts.length > 0 ? 0 : null,
  );
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);

  const addScript = () => {
    const newScript: VoiceScript = {
      name: 'Novo script',
      type: 'custom',
      template: '',
      escalationMessage: 'Vou transferir para um atendente humano.',
    };
    onChange([...scripts, newScript]);
    setExpandedIndex(scripts.length);
  };

  const removeScript = (index: number) => {
    onChange(scripts.filter((_, i) => i !== index));
    setExpandedIndex(null);
  };

  const updateScript = (index: number, partial: Partial<VoiceScript>) => {
    onChange(scripts.map((s, i) => (i === index ? { ...s, ...partial } : s)));
  };

  const handleSuggestScript = async (index: number) => {
    const script = scripts[index];
    if (!script || !tenantId) return;
    setGeneratingIndex(index);
    try {
      const result = await voiceService.suggestScript(tenantId, {
        name: script.name,
        type: script.type,
      });
      updateScript(index, { template: result.template });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar sugestão.';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setGeneratingIndex(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Scripts de conversa</p>
          <p className="text-xs text-muted-foreground">
            Templates que o agente usa em cada cenário. Use {'{nome}'}, {'{valor}'}, {'{vencimento}'} como variáveis.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={addScript}>
          <Plus className="h-3.5 w-3.5" />
          Novo script
        </Button>
      </div>

      {scripts.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2">
          <p className="text-xs font-medium text-foreground">Script ativo</p>
          <p className="text-[10px] text-muted-foreground">
            Script que o agente usará por padrão nas ligações.
          </p>
          <Select
            value={activeScriptName ?? '__none__'}
            onValueChange={(v) => onActiveScriptChange(v === '__none__' ? null : v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecionar script ativo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum (manual)</SelectItem>
              {scripts.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {scripts.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum script configurado.</p>
        </div>
      )}

      {scripts.map((script, index) => (
        <Card
          key={index}
          className={`glass-card cursor-pointer transition-all ${expandedIndex === index ? 'ring-1 ring-primary/30' : ''}`}
        >
          <CardHeader
            className="pb-2 cursor-pointer"
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {script.name}
                <span className="text-[10px] text-muted-foreground font-normal">
                  ({SCRIPT_TYPES.find((t) => t.value === script.type)?.label})
                </span>
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                  onClick={(e) => { e.stopPropagation(); void handleSuggestScript(index); }}
                  disabled={generatingIndex === index}
                >
                  <Sparkles className="h-3 w-3" />
                  {generatingIndex === index ? 'Gerando...' : 'Gerar com IA'}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeScript(index);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {expandedIndex === index && (
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    className="h-8 text-xs"
                    value={script.name}
                    onChange={(e) => updateScript(index, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={script.type}
                    onValueChange={(v) =>
                      updateScript(index, { type: v as VoiceScript['type'] })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCRIPT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Template da conversa</Label>
                <Textarea
                  rows={4}
                  className="text-xs"
                  placeholder="Olá {nome}, aqui é a {agente} da empresa X. Estou ligando sobre..."
                  value={script.template}
                  onChange={(e) => updateScript(index, { template: e.target.value })}
                />
              </div>

              {script.type === 'recovery' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Desconto máximo (%)</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={script.negotiationRules?.maxDiscount ?? 10}
                      onChange={(e) =>
                        updateScript(index, {
                          negotiationRules: {
                            ...script.negotiationRules,
                            maxDiscount: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Parcelas máximas</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={script.negotiationRules?.maxInstallments ?? 6}
                      onChange={(e) =>
                        updateScript(index, {
                          negotiationRules: {
                            ...script.negotiationRules,
                            maxInstallments: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Mensagem de escalação</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Vou transferir para um atendente humano."
                  value={script.escalationMessage ?? ''}
                  onChange={(e) =>
                    updateScript(index, { escalationMessage: e.target.value })
                  }
                />
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
