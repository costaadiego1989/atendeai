import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CreditCard,
  Gauge,
  Loader2,
  MessageSquare,
  Package,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BillingHeader } from '../components/BillingHeader';
import { BillingUsageProgressCard } from '@/modules/billing/components/BillingUsageProgressCard';
import { useBillingPageViewModel } from '@/modules/billing/view-models/useBillingPageViewModel';
import { useAddonPackageViewModel } from '@/modules/billing/view-models/useAddonPackageViewModel';
import { EmptyState } from '@/shared/ui/EmptyState';
import { KPICard } from '@/shared/ui/KPICard';
import { PageSkeleton } from '@/shared/ui/Skeletons';
import { PricingComparisonTable } from '../components/PricingComparisonTable';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/shared/lib/formatters';
import type {
  BillingAdvisorField,
  BillingAdvisorQuestion,
} from '@/modules/billing/view-models/billing-commercial-helpers';
import {
  type BillingCycle,
  calculateMonthlyPrice,
  calculateAnnualTotal,
  isPromoActive,
  getPromoDiscountPercent,
} from '@/modules/billing/view-models/billing-pricing-helpers';

interface AdvisorQuestionRowProps {
  question: BillingAdvisorQuestion;
  onChange: (field: BillingAdvisorField, value: string) => void;
}

function AdvisorQuestionRow({ question, onChange }: AdvisorQuestionRowProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
          {question.label}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{question.helper}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {question.options.map((option) => {
          const active = option.value === question.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(question.field, option.value)}
              className={cn(
                'min-h-[132px] rounded-xl border px-4 py-3 text-left transition-all',
                active
                  ? 'border-primary/40 bg-primary/[0.08] shadow-[0_0_0_1px_rgba(20,184,166,0.12)]'
                  : 'border-border/60 bg-card/80 hover:border-primary/20 hover:bg-muted/40',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-foreground">{option.label}</span>
                {active && (
                  <Badge className="border-none bg-primary/10 text-primary hover:bg-primary/20">
                    Selecionado
                  </Badge>
                )}
              </div>
              <Badge variant="outline" className="mt-3 border-border/60 bg-background/40 text-[10px]">
                Sugere{' '}
                {option.planHint === 'PROFISSIONAL'
                  ? 'Profissional'
                  : option.planHint === 'ESCALA'
                    ? 'Escala'
                    : 'Essencial'}
              </Badge>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BillingUsagePage() {
  const vm = useBillingPageViewModel();
  const addonPackage = useAddonPackageViewModel(vm.tenant?.id);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly');

  if (vm.isLoading) {
    return <PageSkeleton />;
  }

  if (vm.hasError || !vm.usage || !vm.billingPlans) {
    return (
      <div className="page-container animate-fade-in">
        <EmptyState
          icon={CreditCard}
          title="Erro no carregamento"
          description="Não foi possível recuperar os dados de faturamento. Verifique sua conexão ou contate o suporte."
        />
      </div>
    );
  }

  const {
    usage,
    billingPlans,
    currentPlanDefinition,
    selectedPlan,
    selectedPlanRelation,
    messagePercent,
    aiPercent,
    contactsPercent,
    tenantNiche,
    recommendation,
    advisorAnswers,
    advisorQuestions,
    recommendedModules,
    optionalModules,
    currentAddonInvestment,
    subscriptionPricing,
    shouldShowCommercialAdvisor,
  } = vm;

  return (
    <div className="page-container animate-fade-in">
      <BillingHeader
        onConfirmCancel={vm.confirmCancel}
        cancelOpen={vm.cancelOpen}
        setCancelOpen={vm.setCancelOpen}
        isPendingCancel={vm.cancelSubscriptionMutation.isPending}
        isTrial={usage.plan === 'TRIAL' || vm.tenant?.planStatus === 'TRIALING'}
        onExportCsv={vm.exportUsageCsv}
      />

      {usage.scheduledPlan && (
        <Card className="mb-8 overflow-hidden border-amber-500/20 bg-amber-500/[0.03]">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-amber-500/10 p-2.5">
                <CalendarClock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-amber-900">Transição de plano agendada</p>
                <p className="max-w-xl text-sm text-amber-800/80">
                  Seu plano sera alterado para <span className="font-bold">{usage.scheduledPlan}</span>{' '}
                  automaticamente em{' '}
                  {new Date(usage.billingCycle.end).toLocaleDateString('pt-BR')}.
                </p>
              </div>
            </div>
            <Badge className="border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100">
              Proximo ciclo
            </Badge>
          </CardContent>
        </Card>
      )}

      {(messagePercent >= 80 || aiPercent >= 80 || contactsPercent >= 80) && (
        <Card className="mb-8 overflow-hidden border-destructive/20 bg-destructive/[0.03]">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-destructive/10 p-2.5">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-bold text-destructive">Atenção: limite próximo</p>
                <p className="max-w-xl text-sm text-destructive-foreground/80">
                  Você atingiu pelo menos 80% de um dos limites do seu plano. Para evitar interrupções,
                  vale revisar o plano base e os módulos da operação.
                </p>
              </div>
            </div>
            <Button size="sm" variant="destructive" className="w-fit" onClick={vm.openPlansComparison}>
              Ver planos
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Plano atual"
          value={currentPlanDefinition?.displayName ?? usage.plan}
          subtitle={
            <div className="mt-2 flex flex-col gap-1.5">
              <span className="text-xs">
                Ciclo encerra em {new Date(usage.billingCycle.end).toLocaleDateString('pt-BR')}
              </span>
              {tenantNiche && (
                <Badge
                  variant="outline"
                  className="w-fit border-border/50 bg-muted/50 text-[10px]"
                >
                  Nicho: {tenantNiche.displayName}
                </Badge>
              )}
            </div>
          }
          icon={CreditCard}
        />
        <KPICard
          title="Investimento atual"
          value={formatCurrency(subscriptionPricing?.totalMonthlyPrice ?? currentPlanDefinition?.monthlyPrice ?? 0) ?? 'R$ 0,00'}
          subtitle={
            currentAddonInvestment > 0
              ? `${formatCurrency(subscriptionPricing?.baseMonthlyPrice ?? currentPlanDefinition?.monthlyPrice ?? 0) ?? 'R$ 0,00'} de plano base + ${formatCurrency(currentAddonInvestment) ?? 'R$ 0,00'} em módulos`
              : 'Sem add-ons cobrados hoje'
          }
          icon={Sparkles}
        />
        <KPICard
          title="Volume de mensagens"
          value={`${usage.messages.used.toLocaleString('pt-BR')} / ${usage.messages.quota.toLocaleString('pt-BR')}`}
          subtitle={`${messagePercent.toFixed(1)}% do limite atingido`}
          icon={MessageSquare}
        />
        <KPICard
          title="Base de CRM"
          value={`${usage.contacts.used.toLocaleString('pt-BR')} / ${usage.contacts.quota.toLocaleString('pt-BR')}`}
          subtitle={`${contactsPercent.toFixed(1)}% da capacidade contratada`}
          icon={Users}
        />
      </div>

      <div className="mb-10 grid gap-6 lg:grid-cols-3">
        <BillingUsageProgressCard
          title="Mensagens (WhatsApp)"
          subtitle="Uso da franquia de mensagens do plano."
          value={messagePercent}
          icon={MessageSquare}
        />
        <BillingUsageProgressCard
          title="Processamento IA"
          subtitle="Consumo de tokens de inteligência artificial."
          value={aiPercent}
          icon={Bot}
        />
        <BillingUsageProgressCard
          title="Gestão de contatos"
          subtitle="Uso do limite de contatos da base."
          value={contactsPercent}
          icon={Users}
        />
      </div>


      {addonPackage.isAvailable && (messagePercent >= 80 || aiPercent >= 80 || contactsPercent >= 80) && (
        <Card className="mb-10 overflow-hidden border-primary/20 bg-primary/[0.02]">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-2.5">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">Pacote Adicional de Quota</p>
                {addonPackage.isActive ? (
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Pacote ativo neste ciclo. As quotas extras já estão aplicadas.
                  </p>
                ) : addonPackage.awaitingPayment ? (
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Aguardando confirmação do pagamento. As quotas serão atualizadas automaticamente.
                  </p>
                ) : addonPackage.packageDetails ? (
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Adicione +{addonPackage.packageDetails.messages.toLocaleString('pt-BR')} mensagens,
                    {' '}+{addonPackage.packageDetails.contacts.toLocaleString('pt-BR')} contatos e
                    {' '}+{addonPackage.packageDetails.aiTokens.toLocaleString('pt-BR')} tokens de IA
                    por {formatCurrency(addonPackage.packageDetails.price)} neste ciclo.
                  </p>
                ) : null}
              </div>
            </div>
            {addonPackage.isActive ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => addonPackage.cancel()}
                disabled={addonPackage.isCanceling}
              >
                {addonPackage.isCanceling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancelar pacote
              </Button>
            ) : addonPackage.awaitingPayment ? (
              <Button size="sm" variant="outline" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aguardando pagamento
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => addonPackage.purchase()}
                disabled={addonPackage.isPurchasing}
              >
                {addonPackage.isPurchasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Contratar pacote
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {shouldShowCommercialAdvisor && advisorAnswers && recommendation && (
        <div className="mb-10 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card className="border-border/60 bg-card/90">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="border-none bg-primary/10 text-primary hover:bg-primary/20">
                  Guia rápido
                </Badge>
                {tenantNiche && (
                  <Badge variant="outline" className="border-border/60 bg-muted/40">
                    Nicho atual: {tenantNiche.displayName}
                  </Badge>
                )}
              </div>
              <div>
                <CardTitle className="text-2xl">Assistente de escolha do plano</CardTitle>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Ajuste o perfil da sua operação e veja qual plano é mais indicado para você.
                  O valor dos módulos extras é cobrado separadamente.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {advisorQuestions.map((question) => (
                  <AdvisorQuestionRow
                    key={question.field}
                    question={question}
                    onChange={vm.setAdvisorField}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
                <Button onClick={vm.openRecommendedPlan}>
                  Ver e contratar plano indicado
                </Button>
                <Button variant="ghost" onClick={vm.resetAdvisorAnswers}>
                  Recalcular com uso atual
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardHeader className="space-y-4">
              <Badge className="w-fit border-none bg-primary/10 text-primary hover:bg-primary/20">
                Recomendação
              </Badge>
              <div className="space-y-2">
                <CardTitle className="text-2xl leading-tight">
                  {recommendation.headline}
                </CardTitle>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {recommendation.summary}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-primary/20 bg-background/40 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
                      Plano base indicado
                    </p>
                    <p className="mt-2 text-3xl font-black text-foreground">
                      {recommendation.recommendedPlan?.displayName ?? 'Sem plano disponível'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
                      Valor do plano
                    </p>
                    <p className="mt-2 text-2xl font-black text-foreground">
                      {formatCurrency(recommendation.recommendedPlan?.monthlyPrice ?? 0) ?? 'R$ 0,00'}
                    </p>
                    <p className="text-xs text-muted-foreground">Somente plano base</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {recommendation.quotaBenefits.map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3"
                  >
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <p className="text-sm leading-relaxed text-muted-foreground">{benefit}</p>
                  </div>
                ))}
                {recommendation.reasons.map((reason) => (
                  <div
                    key={reason}
                    className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3"
                  >
                    <Gauge className="mt-0.5 h-4 w-4 text-primary" />
                    <p className="text-sm leading-relaxed text-muted-foreground">{reason}</p>
                  </div>
                ))}
                {recommendation.nicheBenefits.map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3"
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                    <p className="text-sm leading-relaxed text-muted-foreground">{benefit}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
                  Módulos extras do nicho
                </p>
                <p className="mt-2 text-lg font-bold text-foreground">
                  {formatCurrency(recommendation.estimatedAddonInvestment) ?? 'R$ 0,00'}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Estimativa caso você ative os módulos recomendados para seu nicho.
                  Esse valor não está incluído no plano base.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div id="plans-comparison" className="space-y-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Planos e escalabilidade
            </h2>
            <p className="text-muted-foreground">
              O comparativo abaixo mostra apenas o plano base. Módulos extras são contratados separadamente.
            </p>
          </div>
          {recommendation?.recommendedPlan && (
            <Badge className="w-fit border-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
              Plano indicado hoje: {recommendation.recommendedPlan.displayName}
            </Badge>
          )}
        </div>

        <PricingComparisonTable
          plans={billingPlans}
          currentPlanCode={usage.plan}
          onSelectPlan={(plan, cycle) => {
            vm.setSelectedPlan(plan);
            setSelectedCycle(cycle);
          }}
          isLoading={vm.changePlanMutation.isPending}
          recommendedPlanCode={recommendation?.recommendedPlan?.code ?? null}
        />
      </div>

      <Sheet open={Boolean(selectedPlan)} onOpenChange={(open) => !open && vm.setSelectedPlan(null)}>
        <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl">Confirmar alteração de plano</SheetTitle>
            <SheetDescription className="text-base text-muted-foreground">
              {selectedPlanRelation === 'upgrade'
                ? `Você está realizando o upgrade para o plano ${selectedPlan?.displayName}.`
                : `Você está agendando um downgrade para o plano ${selectedPlan?.displayName}.`}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            <div
              className={cn(
                'rounded-xl border p-5',
                selectedPlanRelation === 'upgrade'
                  ? 'border-primary/20 bg-primary/[0.02]'
                  : 'border-amber-500/20 bg-amber-500/[0.02]',
              )}
            >
              <p className="flex items-center gap-2 font-semibold text-foreground">
                {selectedPlanRelation === 'upgrade' ? (
                  <CreditCard className="h-4 w-4 text-primary" />
                ) : (
                  <CalendarClock className="h-4 w-4 text-amber-600" />
                )}
                {selectedPlanRelation === 'upgrade'
                  ? 'Cobrança imediata'
                  : 'Alteração no próximo ciclo'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {selectedPlanRelation === 'upgrade'
                  ? 'O upgrade é processado agora. Você será redirecionado para o checkout seguro do Asaas.'
                  : 'A mudança ocorrerá apenas ao final do ciclo atual. Não há reembolso proporcional para downgrades.'}
              </p>
            </div>

            {selectedPlan && (
              <div className="grid gap-4">
                <p className="text-sm font-medium">
                  Novos limites do plano {selectedPlan.displayName}:
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                      Mensagens
                    </p>
                    <p className="mt-2 text-lg font-bold text-foreground">
                      {selectedPlan.messagesQuota.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                      IA (tokens)
                    </p>
                    <p className="mt-2 text-lg font-bold text-foreground">
                      {selectedPlan.aiTokensQuota.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                      Contatos
                    </p>
                    <p className="mt-2 text-lg font-bold text-foreground">
                      {selectedPlan.contactsQuota.toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
                Importante
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                O valor abaixo é apenas do plano base. Módulos extras são cobrados separadamente.
              </p>
            </div>

            <div className="flex items-center justify-between border-t pt-6">
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {selectedCycle === 'annual' ? 'Valor anual' : 'Valor mensal'}
                </span>
                {isPromoActive() ? (
                  <>
                    <span className="text-sm text-muted-foreground line-through">
                      {formatCurrency(selectedPlan?.monthlyPrice ?? 0)}/mês
                    </span>
                    <span className="text-2xl font-black text-foreground">
                      {formatCurrency(calculateMonthlyPrice(selectedPlan?.monthlyPrice ?? 0))}
                      <span className="text-sm font-medium text-muted-foreground"> /mês</span>
                    </span>
                    {selectedCycle === 'annual' && (
                      <span className="text-xs font-medium text-emerald-600">
                        Total anual: {formatCurrency(calculateAnnualTotal(selectedPlan?.monthlyPrice ?? 0))}
                        {' '}({getPromoDiscountPercent()}% de desconto)
                      </span>
                    )}
                    {selectedCycle === 'monthly' && (
                      <span className="text-xs font-medium text-emerald-600">
                        Promoção de lançamento: {getPromoDiscountPercent()}% de desconto
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black text-foreground">
                      {formatCurrency(selectedPlan?.monthlyPrice ?? 0)}
                      <span className="text-sm font-medium text-muted-foreground"> /mês</span>
                    </span>
                    {selectedCycle === 'annual' && (
                      <span className="text-xs font-medium text-muted-foreground">
                        Total anual: {formatCurrency((selectedPlan?.monthlyPrice ?? 0) * 12)}
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => vm.setSelectedPlan(null)}>
                  Voltar
                </Button>
                <Button
                  className="px-8"
                  onClick={() => vm.confirmSelectedPlan(selectedCycle)}
                  disabled={vm.changePlanMutation.isPending}
                >
                  {vm.changePlanMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirmar plano
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={vm.waitingCheckoutOpen} onOpenChange={vm.setWaitingCheckoutOpen}>
        <SheetContent side="right" className="w-[560px] overflow-y-auto sm:max-w-[560px]">
          <SheetHeader className="mb-8">
            <SheetTitle className="text-2xl">Aguardando confirmação</SheetTitle>
            <SheetDescription className="text-base">
              O checkout do Asaas foi iniciado em uma nova aba.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col items-center gap-6 rounded-2xl border border-primary/20 bg-primary/[0.02] px-6 py-12 text-center">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="relative rounded-full bg-primary/10 p-5">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xl font-bold text-foreground">Sincronizando faturamento...</p>
              <p className="leading-relaxed text-muted-foreground">
                Assim que processarmos a confirmação do pagamento pelo gateway, seu plano{' '}
                 <span className="font-bold text-foreground">{vm.pendingCheckoutPlanCode}</span> será
                ativado instantaneamente.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-3">
            <Button className="w-full" variant="default" onClick={vm.refreshBillingStatus}>
              Já efetuei o pagamento, atualizar agora
            </Button>
            <Button className="w-full" variant="ghost" onClick={() => vm.setWaitingCheckoutOpen(false)}>
              Verificar mais tarde
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
