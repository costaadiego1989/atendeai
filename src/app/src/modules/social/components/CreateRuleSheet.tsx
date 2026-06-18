import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Mail, Layers, Zap } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSocialPageViewModel } from '../view-models/useSocialPageViewModel';

interface CreateRuleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vm: ReturnType<typeof useSocialPageViewModel>;
}

export function CreateRuleSheet({ open, onOpenChange, vm }: CreateRuleSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[640px] sm:max-w-[700px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 text-primary bg-primary/10 w-fit p-2 rounded-xl mb-2">
            <Zap className="w-5 h-5" />
          </div>
          <SheetTitle className="text-xl">Novo Workflow de Automação</SheetTitle>
          <SheetDescription>
            Configure gatilhos contextuais e determine as ações para comentários nas publicações conectadas.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-8">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
              <Layers className="w-4 h-4 text-primary" /> 1. Condições de Disparo
            </h3>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Nome Interno da Regra</Label>
                <Input
                  value={vm.state.newRuleForm.name}
                  onChange={(event) =>
                    vm.actions.setNewRuleForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ex: Lead pedindo preço promocional"
                />
              </div>

              <div className="space-y-2">
                <Label>Quais palavras monitorar? (separadas por vírgula)</Label>
                <div className="flex gap-2">
                  <Input
                    value={vm.state.keywordInput}
                    onChange={(event) => vm.actions.setKeywordInput(event.target.value)}
                    placeholder="preço, valor, quanto custa, link"
                  />
                  <Button type="button" variant="outline" onClick={vm.actions.addKeyword}>
                    Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(vm.state.newRuleForm.conditions.keywords ?? []).map((keyword) => (
                    <Badge
                      key={keyword}
                      className="cursor-pointer"
                      onClick={() => vm.actions.removeKeyword(keyword)}
                    >
                      {keyword} ×
                    </Badge>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Deixe em branco se a regra dever aplicar-se a todos os comentários daquele post.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Palavras a excluir</Label>
                <div className="flex gap-2">
                  <Input
                    value={vm.state.excludeKeywordInput}
                    onChange={(event) => vm.actions.setExcludeKeywordInput(event.target.value)}
                    placeholder="spam, teste interno"
                  />
                  <Button type="button" variant="outline" onClick={vm.actions.addExcludeKeyword}>
                    Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(vm.state.newRuleForm.conditions.excludeKeywords ?? []).map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => vm.actions.removeExcludeKeyword(keyword)}
                    >
                      {keyword} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Aplicável a (Publicações)</Label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o alvo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as publicações do Instagram</SelectItem>
                    <SelectItem value="specific">Apenas no Carrossel X (inserir ID)</SelectItem>
                    <SelectItem value="reels">Apenas em formato Reels</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
              <MessageSquare className="w-4 h-4 text-primary" /> 2. Ação Reativa
            </h3>

            <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="action-reply-comment" defaultChecked className="rounded text-primary" aria-label="Responder publicamente ao comentário" />
                <Label htmlFor="action-reply-comment" className="font-semibold text-sm cursor-pointer">Responder Publicamente ao Comentário</Label>
              </div>
              <div className="pl-6 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo da Resposta</Label>
                  <Select
                    value={vm.state.newRuleForm.actions.replyToComment.mode}
                    onValueChange={(value) =>
                      vm.actions.updateRuleActionMode(
                        'replyToComment',
                        value as 'AI_GENERATED' | 'TEMPLATE',
                      )
                    }
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEMPLATE">Texto Fixo Randômico</SelectItem>
                      <SelectItem value="AI_GENERATED">Gerado Dinamicamente Pela IA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Prompt Base da Resposta Pública</Label>
                  <Textarea
                    className="text-xs h-20"
                    value={vm.state.newRuleForm.actions.replyToComment.aiPrompt ?? ''}
                    onChange={(event) =>
                      vm.actions.setNewRuleForm((current) => ({
                        ...current,
                        actions: {
                          ...current.actions,
                          replyToComment: {
                            ...current.actions.replyToComment,
                            aiPrompt: event.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="action-send-inbox" defaultChecked className="rounded text-primary" aria-label="Chamar no Direct (Inbox)" />
                <Label htmlFor="action-send-inbox" className="font-semibold text-sm cursor-pointer border-b border-transparent">Chamar no Direct (Inbox)</Label>
              </div>
              <div className="pl-6 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Delay da Ação (segundos)</Label>
                    <Input
                      type="number"
                      value={vm.state.newRuleForm.actions.sendInboxMessage.delaySeconds}
                      onChange={(event) =>
                        vm.actions.setNewRuleForm((current) => ({
                          ...current,
                          actions: {
                            ...current.actions,
                            sendInboxMessage: {
                              ...current.actions.sendInboxMessage,
                              delaySeconds: Number(event.target.value || 0),
                            },
                          },
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2 mt-2">
                  <Label className="text-xs">Mensagem Inbox (Comercial)</Label>
                  <Textarea
                    className="text-xs h-20"
                    value={vm.state.newRuleForm.actions.sendInboxMessage.templates?.[0] ?? ''}
                    onChange={(event) =>
                      vm.actions.setNewRuleForm((current) => ({
                        ...current,
                        actions: {
                          ...current.actions,
                          sendInboxMessage: {
                            ...current.actions.sendInboxMessage,
                            templates: [event.target.value],
                          },
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-2">
            <h3 className="font-semibold text-sm">Limites e Prioridade</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Prioridade (Maior roda antes)</Label>
                <Input
                  type="number"
                  value={vm.state.newRuleForm.priority}
                  onChange={(event) =>
                    vm.actions.setNewRuleForm((current) => ({
                      ...current,
                      priority: Number(event.target.value || 0),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Cooldown por Usuário</Label>
                <Select defaultValue="24h">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">1 hora</SelectItem>
                    <SelectItem value="24h">24 horas</SelectItem>
                    <SelectItem value="never">Roda a cada comentário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-10 p-4 border-t bg-background/80 sticky bottom-0 -mx-6">
          <Badge variant="secondary" className="bg-success/10 text-success font-normal shadow-sm gap-1">Status Pré-ativo <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse ml-1" /></Badge>
          <div className="gap-2 flex">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={vm.actions.submitRule}
              disabled={!vm.state.canSubmitRule || vm.state.createRuleMutation.isPending}
            >
              {vm.state.createRuleMutation.isPending ? 'Salvando...' : 'Salvar Regra'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
