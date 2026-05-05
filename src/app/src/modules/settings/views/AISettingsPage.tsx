import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { Bot, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAISettingsViewModel } from '@/modules/settings/view-models/useAISettingsViewModel';

export function AISettingsPage() {
  const vm = useAISettingsViewModel();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = vm.form;

  const firstInteractionEnabled = watch('firstInteraction.enabled');
  const scheduleEnabled = watch('scheduleAndInventory.enabled');
  const recoveryEnabled = watch('recovery.enabled');

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div className="page-header">
        <h1 className="page-title">IA Comercial</h1>
        <p className="page-description">
          Parâmetros visuais da persona comercial, descoberta de contexto e segurança operacional.
        </p>
      </div>

      <Tabs defaultValue="persona" className="space-y-5">
        <PageTabsList
          tabs={[
            { value: 'persona', label: 'Persona', icon: Bot },
            { value: 'guardrails', label: 'Guardrails', icon: ShieldCheck },
          ]}
        />

        <TabsContent value="persona" className="grid gap-4 lg:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-primary" />
                Estilo de atendimento
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Define a personalidade da IA na conversa. Isso impacta diretamente como o cliente percebe a marca,
                a clareza das respostas e a chance de avançar para o próximo passo comercial.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tom principal</Label>
                  <p className="text-xs text-muted-foreground">
                    Ajusta o jeito de falar da IA. Um tom mais amigável tende a aumentar proximidade; um tom mais
                    profissional passa mais segurança em vendas consultivas e cobrança.
                  </p>
                  <Select
                    value={watch('tone')}
                    onValueChange={(value) =>
                      setValue('tone', value as 'FRIENDLY' | 'PROFESSIONAL' | 'CASUAL', {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FRIENDLY">Amigável</SelectItem>
                      <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
                      <SelectItem value="CASUAL">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Máximo de tokens por resposta</Label>
                  <p className="text-xs text-muted-foreground">
                    Controla o tamanho médio das respostas. Valores menores deixam a IA mais objetiva e economizam
                    consumo; valores maiores permitem respostas mais completas.
                  </p>
                  <Input type="number" min="50" max="4000" {...register('maxTokensPerResponse')} />
                  <p className="text-xs text-muted-foreground">
                    Se sua operação vende por WhatsApp, respostas mais curtas costumam acelerar atendimento e reduzir
                    custo por conversa.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prompt base</Label>
                <p className="text-xs text-muted-foreground">
                  É a instrução principal da sua IA comercial. Quanto mais claro esse texto estiver, mais consistente
                  a IA fica para qualificar, argumentar e converter sem sair do posicionamento da empresa.
                </p>
                <Textarea
                  rows={8}
                  placeholder="Descreva como a IA deve descobrir a necessidade e conduzir a conversa para fechamento."
                  {...register('systemPrompt')}
                />
                <p className="text-xs text-muted-foreground">
                  Use esse campo para dizer como a IA deve abordar, perguntar, responder objeções e levar o cliente
                  para o próximo passo do funil.
                </p>
                {errors.systemPrompt && (
                  <p className="text-xs text-destructive">{errors.systemPrompt.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Idioma</Label>
                <p className="text-xs text-muted-foreground">
                  Mantém a IA respondendo no idioma padrão da operação e evita misturar termos com o cliente.
                </p>
                <Input {...register('language')} placeholder="pt-BR" />
                <p className="text-xs text-muted-foreground">
                  Ideal para operações que atendem em mais de um país ou querem manter padrão de comunicação.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Comportamento comercial
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Aqui você define quando a IA deve insistir, quando deve escalar para humano e como ela protege a
                operação para não prometer além do que o negócio consegue entregar.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Limiar de handoff</Label>
                  <p className="text-xs text-muted-foreground">
                    Define quando a conversa deve sair da IA e ir para o humano. Um valor maior deixa a IA mais
                    cautelosa; um valor menor deixa a automação tocar mais conversas sozinha.
                  </p>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    {...register('confidenceThreshold')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Isso impacta produtividade do time: mais handoff aumenta controle humano; menos handoff aumenta
                    escala da automação.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-sm font-medium text-foreground">Como funciona</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quanto menor o limiar, menos conversas vão para o humano. Quanto maior, mais conservadora a IA fica.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mensagem de handoff</Label>
                <p className="text-xs text-muted-foreground">
                  É o texto que o cliente recebe quando a IA chama o time humano. Uma boa mensagem reduz atrito e
                  preserva a sensação de continuidade no atendimento.
                </p>
                <Textarea
                  rows={4}
                  placeholder="Ex: vou chamar um especialista humano para te ajudar na próxima etapa."
                  {...register('escalationMessage')}
                />
                <p className="text-xs text-muted-foreground">
                  Essa mensagem evita ruptura na experiência e ajuda o cliente a entender que o atendimento vai
                  continuar, só que com apoio humano.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardrails" className="grid gap-4 lg:grid-cols-3">
          <Card className="glass-card">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Primeira interação</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Controla como a IA abre a conversa comercial.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Impacto no negócio: evita que a IA despeje tudo de uma vez e melhora a taxa de resposta ao
                    começar com descoberta, contexto e perguntas mais naturais.
                  </p>
                </div>
                <Switch
                  checked={firstInteractionEnabled}
                  onCheckedChange={(checked) =>
                    setValue('firstInteraction.enabled', checked, { shouldDirty: true })
                  }
                />
              </div>
              <Textarea
                rows={5}
                disabled={!firstInteractionEnabled}
                {...register('firstInteraction.rule')}
              />
              <p className="text-xs text-muted-foreground">
                Quando esse guardrail está ativo, a IA evita parecer robótica ou atropelar o cliente logo na abertura.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Agenda e estoque</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Impede promessa sem consultar disponibilidade real.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Impacto no negócio: reduz erro operacional, evita retrabalho do time e protege a experiência do
                    cliente quando existe agenda lotada, falta de produto ou baixa capacidade.
                  </p>
                </div>
                <Switch
                  checked={scheduleEnabled}
                  onCheckedChange={(checked) =>
                    setValue('scheduleAndInventory.enabled', checked, { shouldDirty: true })
                  }
                />
              </div>
              <Textarea
                rows={5}
                disabled={!scheduleEnabled}
                {...register('scheduleAndInventory.rule')}
              />
              <p className="text-xs text-muted-foreground">
                Esse cuidado protege margem e reputação porque a IA não confirma algo que o time não consegue cumprir.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Recovery</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mantém o tom da IA alinhado com cobrança e negociação.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Impacto no negócio: ajuda a cobrar com mais firmeza e respeito ao mesmo tempo, reduzindo desgaste
                    com o cliente e aumentando a consistência da negociação.
                  </p>
                </div>
                <Switch
                  checked={recoveryEnabled}
                  onCheckedChange={(checked) =>
                    setValue('recovery.enabled', checked, { shouldDirty: true })
                  }
                />
              </div>
              <Textarea
                rows={5}
                disabled={!recoveryEnabled}
                {...register('recovery.rule')}
              />
              <p className="text-xs text-muted-foreground">
                Um recovery bem calibrado reduz atrito, melhora a chance de acordo e protege a imagem da empresa.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={vm.submit} disabled={vm.isLoading || vm.isSaving}>
          {vm.isSaving ? 'Salvando...' : 'Salvar IA comercial'}
        </Button>
      </div>
    </div>
  );
}
