import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaymentLinksActionDialogs } from '@/modules/sales/components/PaymentLinksActionDialogs';
import { PaymentLinksCreateSheet } from '@/modules/sales/components/PaymentLinksCreateSheet';

import { PaymentLinksTable } from '@/modules/sales/components/PaymentLinksTable';
import {
  PAYMENT_LINK_STATUS_OPTIONS,
  copyTextWithFallback,
  formatSalesCurrency,
} from '@/modules/sales/components/sales-view-helpers';
import { usePaymentLinksPageViewModel } from '@/modules/sales/view-models/usePaymentLinksPageViewModel';
import { KPICard } from '@/shared/ui/KPICard';
import { useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, CreditCard, Download, Filter, PlayCircle, Plus, Search } from 'lucide-react';
import { PaymentLinksHeader } from '../components/PaymentLinksHeader';
import { SalesReportsSheet } from '../components/SalesReportsSheet';

export function PaymentLinksPage() {
  const navigate = useNavigate();
  const vm = usePaymentLinksPageViewModel();
  const summary = vm.summary;
  const accountStatus = vm.financialAccountQuery.data;
  const isBootstrapping = vm.bootstrapFinancialAccountMutation.isPending;

  const handleCopyLink = async (url: string) => {
    const copied = await copyTextWithFallback(url);

    if (copied) {
      toast({
        title: 'Link copiado',
        description: 'O checkout foi copiado para a área de transferência.',
      });
      return;
    }

    toast({
      title: 'Cópia manual',
      description: 'Seu navegador bloqueou a cópia automática. Copie o checkout manualmente.',
    });
    if (typeof window !== 'undefined') {
      window.prompt('Copie manualmente o checkout abaixo:', url);
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <PaymentLinksHeader
        onNewLink={() => vm.setCreateOpen(true)}
        isAccountConfigured={!!accountStatus?.configured}
      />

      <Card className="glass-card border-border/40 bg-background/30 mb-6">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/70">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Relatório de Cobranças</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-3 rounded-xl border border-border/60 bg-background/60 p-1">
              {vm.periodOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={vm.periodFilter === option.value ? 'default' : 'ghost'}
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  title={option.description}
                  onClick={() => vm.setPeriodFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button variant="outline" className="h-11 gap-2 rounded-xl px-4" onClick={vm.downloadReport}>
              <Download className="h-4 w-4" />
              Gerar relatorio
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="card-grid">
        <KPICard
          title="Cobranças geradas"
          value={summary?.totalLinks ?? 0}
          subtitle="Checkout emitido pela plataforma"
          icon={CreditCard}
        />
        <KPICard
          title="Cobranças ativas"
          value={summary?.activeLinks ?? 0}
          subtitle="Aguardando pagamento"
          icon={PlayCircle}
        />
        <KPICard
          title="Cobranças pagas"
          value={summary?.paidLinks ?? 0}
          subtitle={formatSalesCurrency(summary?.paidRevenue)}
          icon={BarChart3}
        />
        <KPICard
          title="Receita potencial"
          value={formatSalesCurrency(summary?.estimatedRevenue)}
          subtitle={summary ? `${summary.pausedLinks} pausadas` : 'Sem dados'}
          icon={CreditCard}
        />
      </div>

      {vm.financialAccountQuery.isSuccess && !accountStatus?.configured ? (
        <Card className="glass-card border-primary/20 bg-primary/5 mb-8">
          <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-base font-bold text-foreground">
                Recebimentos ainda não habilitados
              </p>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Antes da primeira cobrança, precisamos criar a conta financeira da empresa no Asaas para gerar o wallet de repasse.
              </p>

              {!vm.isTenantReadyForPayments ? (
                <div className="flex flex-col gap-3 pt-2">
                  {!vm.hasCompanyAddress && (
                    <div className="w-fit rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-100">
                      Endereço pendente: Complete CEP, Rua e Bairro em Dados da Empresa.
                    </div>
                  )}
                  {!vm.hasOwnerBirthDate && (
                    <div className="w-fit rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-100">
                      Responsável pendente: A data de nascimento é obrigatória para habilitar taxas de repasse.
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto w-fit p-0 font-bold text-primary"
                    onClick={() => navigate('/app/settings/company')}
                  >
                    Ir para Dados da empresa/responsável
                  </Button>
                </div>
              ) : null}
            </div>
            <Button
              className="w-full lg:w-fit px-8"
              onClick={() => vm.submitBootstrap()}
              disabled={!vm.isTenantReadyForPayments || isBootstrapping}
            >
              {isBootstrapping ? 'Habilitando...' : 'Habilitar recebimentos'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={vm.search}
                onChange={(event) => vm.setSearch(event.target.value)}
                placeholder="Buscar por título, descrição ou contato"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={vm.statusFilter} onValueChange={vm.setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_LINK_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={vm.sourceFilter} onValueChange={vm.setSourceFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as origens</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="AI">IA</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={vm.resetFilters} disabled={!vm.hasFilters}>
                Limpar filtros
              </Button>
            </div>
          </div>
        </div>

        <Card className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border/40 bg-muted/20">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
              Operação financeira
            </h2>
          </div>
          <div className="p-0">
            <PaymentLinksTable
              items={vm.items}
              isLoading={vm.paymentLinksQuery.isLoading}
              isError={vm.paymentLinksQuery.isError}
              pagination={vm.pagination}
              currentItemsCount={vm.items.length}
              onPageChange={vm.goToPage}
              onCopyLink={(url) => void handleCopyLink(url)}
              onPause={(item) => vm.setPauseTarget({ id: item.id, name: item.name })}
              onResume={(item) => vm.setResumeTarget({ id: item.id, name: item.name })}
              onDelete={(item) => vm.setDeleteTarget({ id: item.id, name: item.name })}
            />
          </div>
        </Card>
      </div>


      <PaymentLinksCreateSheet vm={vm} />
      <PaymentLinksActionDialogs vm={vm} />
      <SalesReportsSheet vm={vm} />
    </div>
  );
}
