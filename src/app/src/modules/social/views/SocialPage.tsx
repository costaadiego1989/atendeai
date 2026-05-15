import { Tabs } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageTabsList } from '@/components/PageTabs';
import { MessageSquare, Zap, Link, Bot, MessageCircle, Clock, Plus, Settings2, Sparkles, AlertCircle, Share2, Search, ExternalLink } from 'lucide-react';
import { Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSocialPageViewModel } from '../view-models/useSocialPageViewModel';
import { KPICard } from '@/shared/ui/KPICard';
import { CreateRuleSheet } from '../components/CreateRuleSheet';
import { SocialSettingsSheet } from '../components/SocialSettingsSheet';

export function SocialPage() {
  const vm = useSocialPageViewModel();

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">Engajamento Social</h1>
          <p className="page-description mt-1 flex items-center gap-2">
            Responda comentários do Instagram automaticamente com IA.
            <Badge variant="secondary" className="px-2 font-normal text-[10px] uppercase tracking-widest bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Beta</Badge>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => vm.actions.setSettingsOpen(true)}>
            <Settings2 className="w-4 h-4" /> Configurações
          </Button>
          <Button size="sm" className="gap-2" onClick={() => vm.actions.setNewRuleOpen(true)}>
            <Plus className="w-4 h-4" /> Nova Regra
          </Button>
        </div>
      </div>

      <div className="card-grid">
        <KPICard
          title="Volume Total"
          value={
            vm.state.isStatsLoading
              ? '...'
              : String(vm.state.stats?.totalComments ?? 0)
          }
          subtitle="Total de comentários recebidos"
          icon={MessageSquare}
        />
        <KPICard
          title="Aguardando Resposta"
          value={
            vm.state.isStatsLoading
              ? '...'
              : String(vm.state.stats?.pendingComments ?? 0)
          }
          subtitle="Comentários pendentes de ação"
          icon={Clock}
          trend={
            vm.state.isStatsLoading
              ? undefined
              : {
                  value: vm.state.stats?.pendingComments ?? 0,
                  positive: (vm.state.stats?.pendingComments ?? 0) === 0,
                }
          }
        />
        <KPICard
          title="IA Automações"
          value={
            vm.state.isStatsLoading
              ? '...'
              : String(vm.state.stats?.autoRepliedComments ?? 0)
          }
          subtitle="Respostas automáticas executadas"
          icon={Sparkles}
        />
        <KPICard
          title="Workflows Ativos"
          value={
            vm.state.isStatsLoading
              ? '...'
              : String(vm.state.stats?.activeRules ?? 0)
          }
          subtitle="Regras habilitadas no momento"
          icon={Zap}
        />
      </div>

      <Tabs
        value={vm.state.activeTab}
        onValueChange={(val) => vm.actions.setActiveTab(val as any)}
      >
        <PageTabsList
          tabs={[
            { value: 'comments', label: 'Monitor de Inbox & Comentários', icon: MessageCircle },
            { value: 'rules', label: 'Workflows de Automação', icon: Zap },
            { value: 'agent', label: 'Treinamento do Agente', icon: Bot },
            { value: 'accounts', label: 'Canais Integrados', icon: Link }
          ]}
        />
      </Tabs>

      <div className="min-h-[500px]">
        {vm.state.activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Badge variant="secondary" className="hidden lg:inline-flex items-center whitespace-nowrap h-9 px-3.5 rounded-md border-border/60 bg-muted/30">
                  <span className="font-bold text-foreground mr-1.5">{vm.state.commentsTotal}</span>
                  <span className="font-normal text-muted-foreground">resultados</span>
                </Badge>

                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por autor, publicação ou contexto verbal..."
                    className="pl-9"
                  />
                </div>

                <Select defaultValue="all">
                  <SelectTrigger className="w-full lg:w-[220px]">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Status: Automático" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Apenas Pendentes (Crítico)</SelectItem>
                    <SelectItem value="replied">Formatados por IA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
              <Card className="glass-card border-none shadow-sm flex flex-col h-[600px]">
                <div className="p-3 border-b flex items-center justify-between bg-card/40 rounded-t-xl">
                  <h3 className="font-semibold px-2 text-sm text-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Interações</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Pendentes</span>
                    <span className="flex items-center gap-1 mx-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Resolvidos</span>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-0">
                  <div className="divide-y divide-border/50">
                    {vm.state.comments.map(c => (
                      <button
                        key={c.id}
                        onClick={() => vm.actions.setSelectedCommentId(c.id)}
                        className={`w-full text-left p-5 hover:bg-muted/30 transition-all cursor-pointer flex gap-4 ${vm.state.selectedCommentId === c.id ? 'bg-muted/40 border-l-4 border-l-primary/70 pr-4' : 'border-l-4 border-l-transparent'}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
                          {(c.authorUsername?.[0] || 'U').toUpperCase()}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                          <p className="text-sm font-bold truncate tracking-tight">@{c.authorUsername || 'usuário'}</p>
                            <span className="text-xs text-muted-foreground">{new Date(c.receivedAt).toLocaleString('pt-BR')}</span>
                          </div>
                          <p className="text-sm text-foreground/90 py-1">{c.text}</p>
                          <div className="flex items-center gap-2 mt-2 pt-2">
                            {c.status === 'PENDING' ? (
                              <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 text-[10px]">Aguardando Ação</Badge>
                            ) : (
                              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-[10px] gap-1">
                                <Sparkles className="w-3 h-3" /> IA Respondido
                              </Badge>
                            )}
                            <Button variant="ghost" size="sm" className="h-6 text-xs px-2 ml-auto text-primary/80 hover:text-primary">Responder</Button>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </Card>

              <Card className="border shadow-sm hidden lg:flex flex-col bg-card overflow-hidden">
                {vm.state.selectedCommentId ? (
                  <>
                    <div className="p-4 border-b bg-muted/20 flex flex-col gap-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origem da Interação</p>
                      <div className="flex gap-3 bg-background border p-3 rounded-xl items-start">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg shrink-0 flex items-center justify-center shadow-inner">
                          <Share2 className="w-5 h-5 text-white/80" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Post Carrossel (Instagram)</p>
                          <p className="text-sm font-medium line-clamp-2 leading-tight">Chegou a nova coleção de inverno que todos estavam esperando! Aproveite o frete grátis.</p>
                        </div>
                      </div>
                    </div>
                    <ScrollArea className="flex-1 p-5">
                      <div className="space-y-6">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0 text-xs shadow-sm">
                            {(vm.state.selectedComment?.authorUsername?.[0] || 'U').toUpperCase()}
                          </div>
                          <div className="bg-muted p-3.5 rounded-2xl rounded-tl-sm text-sm border shadow-sm">
                            <p className="font-semibold text-xs mb-1 text-primary">@{vm.state.selectedComment?.authorUsername || 'usuário'}</p>
                            {vm.state.selectedComment?.text}
                          </div>
                        </div>

                        {vm.state.commentThread?.replies?.length ? (
                          vm.state.commentThread.replies.map((reply) => (
                          <div key={reply.id} className="flex gap-3 flex-row-reverse">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0 text-xs shadow-sm">
                              <Bot className="w-4 h-4" />
                            </div>
                            <div className="bg-primary/10 text-primary-foreground p-3.5 rounded-2xl rounded-tr-sm text-sm border border-primary/20 shadow-sm max-w-[85%]">
                              <p className="text-foreground">{reply.text}</p>
                            </div>
                          </div>
                          ))
                        ) : null}
                      </div>
                    </ScrollArea>
                    <div className="p-4 border-t bg-muted/10 gap-2 flex">
                      <Input
                        placeholder="Responder no comentário público..."
                        className="h-9 bg-background shadow-sm"
                        value={vm.state.replyDraft}
                        onChange={(event) => vm.actions.setReplyDraft(event.target.value)}
                      />
                      <Button
                        size="sm"
                        className="h-9 px-4 shadow-sm"
                        onClick={vm.actions.submitReply}
                        disabled={vm.state.replyMutation.isPending || !vm.state.replyDraft.trim()}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" /> Enviar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-center text-muted-foreground flex-1 flex flex-col items-center justify-center opacity-70">
                    <div className="w-16 h-16 rounded-full bg-muted/50 border-2 border-dashed border-border flex items-center justify-center mb-4">
                      <MessageCircle className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="font-medium text-sm">Selecione uma interação</p>
                    <p className="text-xs mt-1.5 max-w-[200px] text-center leading-relaxed">Clique em um comentário da lista para visualizar a thread completa e realizar ações.</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {vm.state.activeTab === 'rules' && (
          <Card className="glass-card border-none shadow-sm min-h-[500px]">
            <CardHeader className="border-b bg-card/40">
              <CardTitle className="text-lg">Workflows de Automação Ativos</CardTitle>
              <CardDescription>Defina funis baseados no que seus leads perguntam em comentários criados nos posts.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {vm.state.rules.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {vm.state.rules.map(rule => (
                    <div key={rule.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rule.isActive ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'}`}>
                          {rule.isActive ? <Zap className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-base flex items-center gap-2">
                            {rule.name}
                            {rule.isActive && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none font-normal px-2 text-[10px]">Ativo</Badge>}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1 gap-2 flex items-center">
                            <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                              palavras-chave: {(rule.conditions as any)?.keywords?.join(', ') || 'sem filtro'}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Último disparo: {rule.lastFiredAt ? new Date(rule.lastFiredAt).toLocaleString('pt-BR') : 'nunca'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => vm.actions.toggleRule(rule.id)}>
                          {rule.isActive ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Zap}
                  title="Nenhuma automação cadastrada"
                  description="Crie seu primeiro workflow de auto-resposta para comentários conectando gatilhos com ações de inbox e IA."
                />
              )}
            </CardContent>
          </Card>
        )}

        {vm.state.activeTab === 'agent' && (
          <Card className="glass-card border-none shadow-sm min-h-[500px]">
            <CardHeader className="border-b bg-card/40">
              <CardTitle className="text-lg flex items-center gap-2"><Bot className="w-5 h-5 text-primary" /> Inteligência do Agente</CardTitle>
              <CardDescription>Determine o tom de voz livre da IA ao interagir com posts na qual uma resposta fixa não foi configurada.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 max-w-3xl">
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Prompt de Contexto para Redes Sociais</label>
                  <textarea
                    className="w-full min-h-[150px] p-4 text-sm rounded-xl border border-input bg-background focus:ring-1 focus:ring-primary shadow-sm"
                    defaultValue="Você atua como um community manager da nossa marca. Seja sempre acolhedor, use linguagem jovem e utilize emojis (😊, 🔥, 🚀). Caso um usuário pergunte preços e você não tiver essa informação em base de conhecimento, peça gentilmente para chamarem no direct."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-xl bg-card">
                    <p className="text-sm font-semibold mb-1">Limites de Token (Tamanho)</p>
                    <p className="text-xs text-muted-foreground mb-3">Tamanho ideal para as respostas na mídia pública.</p>
                    <select className="w-full h-9 rounded-md border px-3 text-sm bg-background">
                      <option>Pequenas (1-2 frases max)</option>
                      <option>Normal (2-4 frases)</option>
                      <option>Longas Explicativas</option>
                    </select>
                  </div>
                  <div className="p-4 border rounded-xl bg-card">
                    <p className="text-sm font-semibold mb-1">Direcionamento Padrão Inbox</p>
                    <p className="text-xs text-muted-foreground mb-3">Ao não saber responder publicamente:</p>
                    <div className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="rounded" defaultChecked /> Recomendar direct link
                    </div>
                  </div>
                </div>
                <Button>Salvar Comportamento</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {vm.state.activeTab === 'accounts' && (
          <Card className="glass-card border-none shadow-sm min-h-[500px]">
            <CardHeader className="border-b bg-card/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Canais Sociais de Escuta</CardTitle>
                <CardDescription>Contas ativas associadas ao seu respectivo Tenant.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Adicionar Conta
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {vm.state.accounts.map((account) => (
                <div key={account.id} className="p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] p-[2px]">
                      <div className="w-full h-full bg-background rounded-full flex items-center justify-center p-1">
                        <img src="/logo.png" alt="ig" className="rounded-full w-full h-full object-cover" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold flex items-center gap-2">@{account.username || 'conta'} <Badge className={account.status === 'ACTIVE' ? 'bg-emerald-500' : ''}>{account.status}</Badge></h3>
                      <p className="text-sm text-muted-foreground">Instagram Business API • Conectada em {new Date(account.connectedAt).toLocaleString('pt-BR')}.</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => vm.actions.disconnectAccount(account.id)}>Desconectar</Button>
                </div>
                ))}

                <div className="p-8 text-center bg-muted/20">
                  <p className="text-sm text-muted-foreground font-medium mb-4">Mais plataformas em breve (Alpha)</p>
                  <Button variant="secondary" className="gap-2 opacity-50" disabled>
                    <ExternalLink className="w-4 h-4" /> Conectar LinkedIn
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <CreateRuleSheet
        open={vm.state.newRuleOpen}
        onOpenChange={vm.actions.setNewRuleOpen}
        vm={vm}
      />
      <SocialSettingsSheet
        open={vm.state.settingsOpen}
        onOpenChange={vm.actions.setSettingsOpen}
      />
    </div>
  );
}
