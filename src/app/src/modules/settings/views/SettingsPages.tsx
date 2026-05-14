import { useState } from 'react';
import { CardSkeleton } from '@/shared/ui/Skeletons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Bot,
  CheckCircle2,
  ExternalLink,
  Gift,
  Link2,
  MessageSquare,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/shared/stores/auth-store';
import { formatDate } from '@/shared/lib/formatters';
import { formatPhone } from '@/shared/lib/masks';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useChannelsSettingsViewModel } from '@/modules/settings/view-models/useChannelsSettingsViewModel';
import { useAISettingsViewModel } from '@/modules/settings/view-models/useAISettingsViewModel';
import { companySettingsService } from '@/modules/settings/services/company-settings-service';
import { useCompanySettingsQuery } from '@/modules/settings/view-models/useCompanySettingsQuery';
import { usersService } from '@/modules/users/services/users-service';
import { usePromotionsSettingsViewModel } from '@/modules/settings/view-models/usePromotionsSettingsViewModel';
export { ChannelsSettingsContent as ChannelsSettingsPage } from '@/modules/settings/views/ChannelsSettingsContent';

function LegacyChannelsSettingsPage() {
  const vm = useChannelsSettingsViewModel();
  const connection = vm.connectionQuery.data?.connection;

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div className="page-header">
        <h1 className="page-title">Canais</h1>
        <p className="page-description">
          O onboarding de WhatsApp agora e guiado pela Twilio. O cliente não precisa colar chave manual do provedor.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" />
              WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">conexão principal via Twilio</p>
                <p className="text-xs text-muted-foreground">
                  O onboarding acontece por Embedded Signup. Aqui voce acompanha status, verifica OTP e sincroniza o sender.
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

            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
              <p className="text-sm font-medium text-foreground">Como funciona</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O cliente informa o número comercial, abre o popup oficial do Facebook e conclui o Embedded Signup sem preencher IDs tecnicos. Depois disso, registramos o sender pela API da Twilio e, se necessario, validamos o OTP.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-2">
                <Label>número do WhatsApp</Label>
                <Input
                  placeholder="+55 11 99999-9999"
                  value={vm.phoneNumber}
                  onChange={(event) => vm.setPhoneNumber(event.target.value)}
                />
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Sem campo tecnico</p>
                    <p className="text-xs text-muted-foreground">
                      O WABA ID vem do popup oficial do Facebook. O cliente não precisa descobrir nem copiar esse dado.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm font-medium text-foreground">Fluxo guiado</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  '1. Digite o número comercial que sera conectado.',
                  '2. Continue com o popup oficial do Facebook.',
                  '3. Se houver OTP, valide o codigo nesta mesma tela.',
                ].map((step) => (
                  <div key={step} className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                className="flex-1 gap-2"
                onClick={() =>
                  vm.startEmbeddedSignupMutation.mutate({
                    phoneNumber: vm.phoneNumber,
                  })
                }
                disabled={
                  vm.startEmbeddedSignupMutation.isPending ||
                  !vm.phoneNumber.trim() ||
                  !vm.embeddedSignupReady
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

            {connection && (
              <div className="rounded-xl border border-border/60 p-4 text-sm">
                <p className="font-medium text-foreground">Sender atual</p>
                <div className="mt-3 space-y-1 text-muted-foreground">
                  <p>número: {connection.whatsappNumber || 'não informado'}</p>
                  <p>Provider: {connection.provider}</p>
                  <p>Status: {connection.status}</p>
                  <p>Sender SID: {connection.senderSid || 'Aguardando criação'}</p>
                  <p>Conta WhatsApp: {connection.wabaId || 'Sera preenchida automaticamente pelo Facebook'}</p>
                </div>
              </div>
            )}

            {vm.requiresVerification && (
              <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Validar codigo OTP</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Se a Twilio enviar codigo por SMS ou voz, informe aqui para concluir a ativação do sender.
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

      </div>
    </div>
  );
}


export function PromotionsSettingsPage() {
  const vm = usePromotionsSettingsViewModel();

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" />
            Promoções
          </h1>
          <p className="page-description mt-1">
            Organize promoções para seus clientes com validade, responsável e controle operacional.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 w-fit" onClick={vm.openCreateSheet}>
          <Plus className="h-4 w-4" />
          Nova promoção
        </Button>
      </div>

      <div className="card-grid mb-8">
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-muted-foreground">Total</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{vm.stats.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">Promoções cadastradas</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-muted-foreground">Ativas</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{vm.stats.active}</p>
            <p className="mt-1 text-xs text-muted-foreground">Campanhas em vigência</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-muted-foreground">Expiradas</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{vm.stats.expired}</p>
            <p className="mt-1 text-xs text-muted-foreground">Campanhas encerradas</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-muted-foreground">Com responsável</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{vm.stats.withOwner}</p>
            <p className="mt-1 text-xs text-muted-foreground">Vinculadas a um operador</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="glass-card space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={vm.search}
                onChange={(event) => vm.setSearch(event.target.value)}
                placeholder="Buscar por título ou descrição..."
                className="pl-9"
              />
            </div>
            <Select value={vm.statusFilter} onValueChange={(v: any) => vm.setStatusFilter(v)}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="ACTIVE">Ativas</SelectItem>
                <SelectItem value="EXPIRED">Expiradas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {vm.tenantSettingsQuery.isLoading && !vm.tenantSettingsQuery.data ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : vm.promotions.length ? (
          <div className="space-y-3">
            {vm.promotions.map((promo) => (
              <Card key={promo.id ?? promo.title} className="glass-card hover:bg-muted/30 transition-colors">
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{promo.title}</p>
                      <StatusBadge status={promo.active ? 'ACTIVE' : 'CLOSED'} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {promo.discountType === 'PERCENTAGE'
                        ? `Desconto ${promo.value ?? `${promo.discount ?? 0}%`}`
                        : promo.value ?? 'Valor promocional'}
                    </p>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground line-clamp-2">
                      {promo.description}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:min-w-[260px] sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">
                        Expira em
                      </p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {formatDate(promo.expiresAt ?? promo.validTo) ?? 'Sem data'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">
                        Responsável
                      </p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {promo.assignedUserName ?? 'Sem responsável'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:self-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => vm.openEditSheet(promo.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => vm.initiateDeletePromotion(promo.id!)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="glass-card">
            <CardContent className="p-12 text-center">
              <Gift className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-bold text-foreground">Nenhuma promoção encontrada</p>
              <p className="text-sm text-muted-foreground mt-2 mb-6">
                Ajuste os filtros ou crie a primeira campanha com validade e responsável.
              </p>
              <Button variant="outline" onClick={vm.openCreateSheet}>
                <Plus className="h-4 w-4 mr-2" />
                Nova promoção
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Sheet
        open={vm.sheetOpen}
        onOpenChange={(open) => {
          vm.setSheetOpen(open);
          if (!open) {
            vm.resetPromotionForm();
          }
        }}
      >
        <SheetContent side="right" className="w-[640px] sm:max-w-[640px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {vm.editingPromotionId ? 'Editar promoção' : 'Nova promoção'}
            </SheetTitle>
            <SheetDescription>
              Cadastre a oferta no mesmo padrão das outras telas, com expiração e usuário responsável.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="promotion-title">Nome da promoção</Label>
              <Input
                id="promotion-title"
                placeholder="Ex: 10% OFF primeiro serviço"
                value={vm.promotionForm.title}
                onChange={(event) =>
                  vm.setPromotionForm((current: any) => ({ ...current, title: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="promotion-discount">Desconto</Label>
                <Input
                  id="promotion-discount"
                  type="number"
                  placeholder="10"
                  value={vm.promotionForm.discount}
                  onChange={(event) =>
                    vm.setPromotionForm((current: any) => ({ ...current, discount: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promotion-type">Tipo</Label>
                <Select
                  value={vm.promotionForm.type}
                  onValueChange={(value) =>
                    vm.setPromotionForm((current: any) => ({ ...current, type: value }))
                  }
                >
                  <SelectTrigger id="promotion-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentual</SelectItem>
                    <SelectItem value="FIXED">Valor fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="promotion-expires-at">Data de expiração</Label>
                <Input
                  id="promotion-expires-at"
                  type="date"
                  value={vm.promotionForm.expiresAt}
                  onChange={(event) =>
                    vm.setPromotionForm((current: any) => ({ ...current, expiresAt: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promotion-assigned-user">Vincular a um usuário</Label>
                <Select
                  value={vm.promotionForm.assignedUserId}
                  onValueChange={(value) =>
                    vm.setPromotionForm((current: any) => ({ ...current, assignedUserId: value }))
                  }
                >
                  <SelectTrigger id="promotion-assigned-user">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Sem responsável definido</SelectItem>
                    {(vm.usersQuery.data ?? []).map((teamUser) => (
                      <SelectItem key={teamUser.id} value={teamUser.id}>
                        {teamUser.name}
                        {teamUser.phone ? ` - ${formatPhone(teamUser.phone)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promotion-description">Descrição</Label>
              <Textarea
                id="promotion-description"
                rows={6}
                placeholder="Explique como a campanha deve ser usada pelo time comercial."
                value={vm.promotionForm.description}
                onChange={(event) =>
                  vm.setPromotionForm((current: any) => ({ ...current, description: event.target.value }))
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  vm.setSheetOpen(false);
                  vm.resetPromotionForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={vm.savePromotion}
                disabled={
                  vm.isSavingPromotion ||
                  !vm.promotionForm.title.trim() ||
                  !vm.promotionForm.discount.trim() ||
                  !vm.promotionForm.description.trim()
                }
              >
                {vm.isSavingPromotion
                  ? 'Salvando...'
                  : vm.editingPromotionId
                    ? 'Salvar alterações'
                    : 'Salvar promoção'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
