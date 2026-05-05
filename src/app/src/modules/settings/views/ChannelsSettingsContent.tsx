import { Bot, ExternalLink, Linkedin, Link2, MessageSquare, RefreshCcw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useChannelsSettingsViewModel } from '@/modules/settings/view-models/useChannelsSettingsViewModel';
import { ModuleAgentRuleButton } from '@/modules/agent-rules/components/ModuleAgentRuleButton';

export function ChannelsSettingsContent() {
  const vm = useChannelsSettingsViewModel();
  const connection = vm.connection;

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">Canais</h1>
          <p className="page-description">
            Conecte multiplos números por Matriz ou filial, acompanhe a ativação via Twilio e vincule contas do Instagram para cada Operação.
          </p>
        </div>
        <ModuleAgentRuleButton moduleId="channels" buttonSize="sm" className="gap-1.5 shrink-0" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-muted-foreground">
              Escopos
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">{vm.stats.totalScopes}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Matriz e filiais disponiveis para conexão.
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-muted-foreground">
              WhatsApp ativo
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {vm.stats.whatsappConnectedCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              números prontos para operar na Twilio.
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-muted-foreground">
              Instagram ativo
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {vm.stats.instagramConnectedCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Contas vinculadas ao escopo operacional.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4 text-primary" />
              Escopos operacionais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(vm.scopes ?? []).map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => vm.setSelectedScopeId(scope.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${vm.selectedScope?.id === scope.id
                  ? 'border-primary/50 bg-primary/[0.06]'
                  : 'border-border/60 bg-background/40 hover:bg-muted/20'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{scope.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{scope.subtitle}</p>
                  </div>
                  <StatusBadge
                    status={
                      scope.whatsappConnected || scope.instagramConnected
                        ? 'ACTIVE'
                        : scope.whatsappStatus === 'PENDING_VERIFICATION'
                          ? 'PENDING'
                          : 'INACTIVE'
                    }
                  />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <p>WhatsApp: {scope.whatsappNumber || 'não configurado'}</p>
                  <p>Instagram: {scope.instagramAccountId || 'não configurado'}</p>
                </div>
              </button>
            ))}

            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
              <p className="text-sm font-medium text-foreground">Modelo operacional</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cada escopo pode ter seu proprio número comercial e sua propria conta do Instagram. Isso permite operar Matriz e filiais com identidade separada.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-primary" />
                Configurar WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {vm.selectedScope?.label ?? 'Escopo'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Onboarding guiado por Embedded Signup da Meta dentro da Twilio.
                  </p>
                </div>
                <StatusBadge
                  status={
                    connection?.status === 'ACTIVE'
                      ? 'ACTIVE'
                      : connection?.status === 'PENDING_VERIFICATION'
                        ? 'PENDING'
                        : 'INACTIVE'
                  }
                />
              </div>

              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-sm font-medium text-foreground">Passo a passo simples</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {[
                    '1. Escolha Matriz ou a filial que vai operar este número.',
                    '2. Digite o telefone comercial e conclua o popup oficial da Meta.',
                    '3. Se houver OTP, valide aqui e acompanhe o status do sender.',
                  ].map((step) => (
                    <div
                      key={step}
                      className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground"
                    >
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-2">
                  <Label>Número do WhatsApp</Label>
                  <Input
                    placeholder="(21) 99999-9999"
                    value={vm.phoneNumber}
                    onChange={(event) => vm.setPhoneNumber(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Não precisa digitar +55. Se você informar um numero brasileiro com DDD, completamos o codigo do pais automaticamente.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="gap-2"
                  onClick={() =>
                    vm.startEmbeddedSignupMutation.mutate({
                      phoneNumber: vm.normalizedPhoneNumber,
                      branchId: vm.selectedBranchId ?? undefined,
                    })
                  }
                  disabled={
                    vm.startEmbeddedSignupMutation.isPending ||
                    !vm.normalizedPhoneNumber.trim()
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                  {vm.startEmbeddedSignupMutation.isPending
                    ? 'Abrindo Facebook...'
                    : 'Continuar com Facebook'}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => vm.refreshMutation.mutate()}
                  disabled={vm.refreshMutation.isPending}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Atualizar status
                </Button>
              </div>

              {!vm.embeddedSignupReady && (
                <p className="text-xs text-muted-foreground">
                  A tela já está pronta. Para concluir a conexão real, faltam apenas as envs do Embedded Signup da Twilio/Meta no backend.
                </p>
              )}

              {vm.requiresVerification && (
                <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Validar codigo OTP</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Se a Twilio enviar codigo por SMS ou voz, informe aqui para concluir a ativação do sender neste escopo.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Codigo de verificação"
                      value={vm.verificationCode}
                      onChange={(event) => vm.setVerificationCode(event.target.value)}
                    />
                    <Button
                      onClick={() => vm.verifyMutation.mutate(vm.verificationCode)}
                      disabled={vm.verifyMutation.isPending || !vm.verificationCode.trim()}
                    >
                      Validar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-primary" />
                Configurar Instagram
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Conta do escopo {vm.selectedScope?.label ?? 'selecionado'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vincule o identificador da conta do Instagram que respondera por esta Operação.
                  </p>
                </div>
                <StatusBadge
                  status={vm.selectedScope?.instagramConnected ? 'ACTIVE' : 'INACTIVE'}
                />
              </div>

              <div className="space-y-2">
                <Label>Conectar conta com a Meta</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="gap-2"
                    onClick={() => vm.startInstagramMetaConnectionMutation.mutate()}
                    disabled={vm.startInstagramMetaConnectionMutation.isPending}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {vm.startInstagramMetaConnectionMutation.isPending
                      ? 'Abrindo Meta...'
                      : 'Continuar com Meta/Facebook'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esse e o fluxo oficial sugerido pela Meta: o usuario faz login no Facebook/Meta, concede acesso e o sistema lista as contas de Instagram Business disponiveis para escolha.
                </p>
              </div>

              {vm.instagramAccounts.length > 0 && (
                <div className="space-y-2">
                  <Label>Contas encontradas neste login</Label>
                  <Select
                    value={vm.instagramAccountId}
                    onValueChange={vm.setInstagramAccountId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta do Instagram" />
                    </SelectTrigger>
                    <SelectContent>
                      {vm.instagramAccounts.map((account) => (
                        <SelectItem
                          key={account.instagramAccountId}
                          value={account.instagramAccountId}
                        >
                          {account.username
                            ? `@${account.username}`
                            : account.pageName || account.instagramAccountId}
                          {account.pageName ? ` • ${account.pageName}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>ID da conta do Instagram Business (modo avancado)</Label>
                <Input
                  placeholder="Ex: 17841400000000000"
                  value={vm.instagramAccountId}
                  onChange={(event) => vm.setInstagramAccountId(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Se preferir, voce ainda pode colar o ID manualmente. Esse escopo ficara responsavel pelas conversas deste canal.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="gap-2"
                  onClick={() =>
                    vm.configureInstagramMutation.mutate(vm.instagramAccountId)
                  }
                  disabled={
                    vm.configureInstagramMutation.isPending ||
                    !vm.instagramAccountId.trim()
                  }
                >
                  <Link2 className="h-4 w-4" />
                  {vm.configureInstagramMutation.isPending
                    ? 'Salvando conta...'
                    : 'Salvar conta Meta'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Linkedin className="h-4 w-4 text-primary" />
                Configurar LinkedIn
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                  Em breve
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Canal profissional para prospecção
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A integração será liberada sem pedir token ou credencial nesta etapa.
                  </p>
                </div>
                <StatusBadge status="INACTIVE" />
              </div>
              <Button variant="outline" className="gap-2" disabled>
                <Linkedin className="h-4 w-4" />
                Conectar LinkedIn
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Politica de roteamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Fila humana habilitada</p>
                  <p className="text-xs text-muted-foreground">
                    Mantem o desenho visual da triagem entre IA e Operação humana.
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="space-y-2">
                <Label>Canal preferêncial</Label>
                <Select defaultValue="WHATSAPP">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                    <SelectItem value="LINKEDIN" disabled>
                      LinkedIn - Em breve
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observações operacionais</Label>
                <Textarea rows={5} placeholder="Ex: a filial do shopping usa apenas Instagram no horario noturno." />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
