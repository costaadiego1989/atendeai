import { Bot, ExternalLink, Instagram, Link2, MessageSquare, RefreshCcw, ShieldAlert, Unlink } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { KPICard } from '@/shared/ui/KPICard';
import { useChannelsSettingsViewModel } from '@/modules/settings/view-models/useChannelsSettingsViewModel';

export function ChannelsSettingsContent() {
  const vm = useChannelsSettingsViewModel();
  const connection = vm.connection;

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">Canais</h1>
          <p className="page-description">
            Conecte múltiplos números por Matriz ou filial via Meta Cloud API e vincule contas do Instagram para cada operação.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Escopos"
          value={vm.stats.totalScopes}
          subtitle="Matriz e filiais disponíveis para conexão."
        />
        <KPICard
          title="WhatsApp ativo"
          value={vm.stats.whatsappConnectedCount}
          subtitle="Números prontos para operar via Meta Cloud API."
        />
        <KPICard
          title="Instagram ativo"
          value={vm.stats.instagramConnectedCount}
          subtitle="Contas vinculadas ao escopo operacional."
        />
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
                Cada escopo pode ter seu próprio número comercial e sua própria conta do Instagram. Isso permite operar Matriz e filiais com identidade separada.
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
                    Onboarding via Meta Embedded Signup — WhatsApp Cloud API.
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
                    '3. Aguarde a ativação e acompanhe o status da conexão.',
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
                    Não precisa digitar +55. Se você informar um número brasileiro com DDD, completamos o código do país automaticamente.
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-medium text-foreground">
                    Antes de conectar — pré-requisitos da Meta
                  </p>
                </div>
                <ul className="ml-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  <li>
                    Tenha um perfil empresarial completo no Meta Business (nome legal, endereço e site).
                  </li>
                  <li>
                    Conclua a Verificação do Negócio em business.facebook.com → Configurações do Negócio → Central de Segurança.
                  </li>
                  <li>
                    Se aparecer aviso de novo dispositivo/localização (erro #2859043), atualize a página e conclua a verificação de segurança antes de tentar de novo.
                  </li>
                  <li>
                    Use a mesma conta Meta que administra o WhatsApp Business durante o popup.
                  </li>
                </ul>
                <a
                  href="https://business.facebook.com/settings/security"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Abrir Central de Segurança da Meta
                  <ExternalLink className="h-3 w-3" />
                </a>
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
                  <MessageSquare className="h-4 w-4" />
                  {vm.startEmbeddedSignupMutation.isPending
                    ? 'Conectando...'
                    : 'Conectar WhatsApp'}
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

              {vm.requiresVerification && (
                <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Validar código OTP</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Se a Twilio enviar código por SMS ou voz, informe aqui para concluir a ativação do sender neste escopo.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Código de verificação"
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
                <Instagram className="h-4 w-4 text-primary" />
                Instagram
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vm.selectedScope?.instagramConnected ? (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] p-[2px]">
                        <div className="w-full h-full bg-background rounded-full flex items-center justify-center">
                          <Instagram className="h-4 w-4 text-foreground" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {vm.selectedScope?.instagramAccountId
                            ? `ID: ${vm.selectedScope.instagramAccountId}`
                            : 'Conta conectada'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Escopo: {vm.selectedScope?.label}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status="ACTIVE" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => vm.startInstagramMetaConnectionMutation.mutate()}
                      disabled={vm.startInstagramMetaConnectionMutation.isPending}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      {vm.startInstagramMetaConnectionMutation.isPending
                        ? 'Conectando...'
                        : 'Trocar conta'}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => vm.disconnectInstagramMutation.mutate()}
                      disabled={vm.disconnectInstagramMutation.isPending}
                    >
                      <Unlink className="h-4 w-4" />
                      {vm.disconnectInstagramMutation.isPending
                        ? 'Desconectando...'
                        : 'Desconectar'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Conecte sua conta Instagram Business para habilitar engajamento automático e resposta a comentários via IA.
                  </p>

                  <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                      <p className="text-sm font-medium text-foreground">
                        Pré-requisitos
                      </p>
                    </div>
                    <ul className="ml-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      <li>Conta Instagram Profissional/Empresa (não pessoal)</li>
                      <li>Vinculada a uma Página do Facebook que você administra</li>
                      <li>No popup da Meta, marque a empresa, Página e conta do Instagram</li>
                    </ul>
                  </div>

                  <Button
                    className="gap-2"
                    onClick={() => vm.startInstagramMetaConnectionMutation.mutate()}
                    disabled={vm.startInstagramMetaConnectionMutation.isPending}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {vm.startInstagramMetaConnectionMutation.isPending
                      ? 'Conectando via Meta...'
                      : 'Conectar com Meta Business'}
                  </Button>

                  {vm.instagramAccounts.length > 0 && (
                    <div className="space-y-2">
                      <Label>Contas encontradas</Label>
                      <Select
                        value={vm.instagramAccountId}
                        onValueChange={vm.setInstagramAccountId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a conta" />
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
                      <Button
                        className="gap-2"
                        onClick={() => vm.configureInstagramMutation.mutate(vm.instagramAccountId)}
                        disabled={vm.configureInstagramMutation.isPending || !vm.instagramAccountId.trim()}
                      >
                        <Link2 className="h-4 w-4" />
                        {vm.configureInstagramMutation.isPending ? 'Salvando...' : 'Vincular conta'}
                      </Button>
                    </div>
                  )}
                </>
              )}
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
        </div>
      </div>
    </div>
  );
}
