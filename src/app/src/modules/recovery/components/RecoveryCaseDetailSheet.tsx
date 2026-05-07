import {
  CheckCircle2,
  type LucideIcon,
  Repeat,
  Phone,
  Send,
  SendHorizontal,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  formatCurrency as formatCurrencyValue,
  formatDateTime,
} from '@/shared/lib/formatters';
import { formatPhone } from '@/shared/lib/masks';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { recoverySourceLabels } from '@/modules/recovery/components/RecoveryLabel';
import {
  getRecoveryCommercialContext,
  getRecoveryCommercialToneClassName,
} from '@/modules/recovery/utils/recovery-commercial';
import {
  buildRecoveryFallbackMilestones,
  mapContactTimelineEntryToVisual,
} from '@/modules/recovery/components/RecoveryTimelineHelper';
import { recoveryPlaybookHasPendingPhases } from '@/modules/recovery/view-models/useRecoveryViewModelHelper';
import type { RecoveryPageViewModel } from '@/modules/recovery/view-models/useRecoveryPageViewModel';

const INTERNAL_RECOVERY_TAG_PREFIX = 'system:';

function formatCurrency(value?: number) {
  return formatCurrencyValue(value) ?? '-';
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('pt-BR') : 'não informado';
}

type RecoveryActionKey = 'OUTREACH' | 'GUIDANCE' | 'PAYMENT' | 'STATUS';

type RecoveryActionConfig = {
  key: RecoveryActionKey;
  label: string;
  description: string;
  icon: LucideIcon;
  variant?: 'default' | 'outline' | 'secondary';
  disabled?: boolean;
};

type RecoverySignal = {
  label: string;
  value: string;
};

type RecoveryWorkflowState = 'CURRENT' | 'DONE' | 'LOCKED';

type RecoveryWorkflowStepConfig = {
  step: 1 | 2 | 3;
  label: string;
  title: string;
  description: string;
  state: RecoveryWorkflowState;
  action: RecoveryActionConfig;
};

function buildRecoveryWorkflowUI(
  item: NonNullable<RecoveryPageViewModel['selectedCase']>,
  guidanceAlreadySent: boolean,
  allowAnotherOutreach: boolean,
) {
  const contactDone = Boolean(item.lastContactedAt);
  const outreachDisabled = contactDone && !allowAnotherOutreach;
  const paymentLinkDone = Boolean(item.paymentReference);
  const workflowStep = !contactDone ? 1 : !paymentLinkDone ? 2 : 3;
  const canSendPaymentLink = contactDone && item.amountDue != null;
  const canUpdateStatus =
    paymentLinkDone || item.status === 'PROMISE_TO_PAY' || item.status === 'PAID';

  const steps: RecoveryWorkflowStepConfig[] = [
    {
      step: 1,
      label: 'Contato',
      title: outreachDisabled
        ? 'Contato realizado'
        : contactDone && item.playbookId
          ? 'Próximo envio (roteiro)'
          : 'Fazer primeiro contato',
      description:
        outreachDisabled && contactDone
          ? item.lastContactedAt
            ? `Ultima mensagem enviada em ${formatDate(item.lastContactedAt)}.`
            : 'O cliente ja recebeu a primeira abordagem.'
          : contactDone && item.playbookId && allowAnotherOutreach
            ? 'Este caso segue um roteiro de cobrança: envie a próxima fase quando as regras de prazo forem atendidas.'
            : !contactDone
              ? 'Abra a conversa com o cliente antes de qualquer Cobrança.'
              : item.lastContactedAt
                ? `Ultima mensagem enviada em ${formatDate(item.lastContactedAt)}.`
                : 'O cliente ja foi abordado.',
      state: outreachDisabled ? 'DONE' : 'CURRENT',
      action: {
        key: 'OUTREACH',
        label:
          outreachDisabled
            ? 'Contato realizado'
            : contactDone && item.playbookId
              ? 'Enviar fase do roteiro'
              : 'Fazer primeiro contato',
        description:
          item.playbookId && allowAnotherOutreach
            ? 'Envia a mensagem da fase actual do playbook (IA ou modelo).'
            : 'Envia a mensagem inicial ao cliente.',
        icon: Send,
        variant: outreachDisabled ? 'outline' : 'default',
        disabled: outreachDisabled,
      },
    },
    {
      step: 2,
      label: 'Conversa',
      title: paymentLinkDone ? 'Link enviado' : 'Enviar link de pagamento',
      description: !contactDone
        ? 'Disponivel depois que o contato for realizado.'
        : paymentLinkDone
          ? 'A Cobrança ja foi enviada ao cliente.'
          : item.amountDue == null
            ? 'Configure um valor para liberar a Cobrança.'
            : guidanceAlreadySent || item.status === 'NEGOTIATING' || item.status === 'PROMISE_TO_PAY'
              ? 'Gere e envie o link assim que houver aceite do cliente.'
              : 'Depois do contato, envie a Cobrança quando o cliente estiver pronto.',
      state: paymentLinkDone ? 'DONE' : workflowStep === 2 ? 'CURRENT' : 'LOCKED',
      action: {
        key: 'PAYMENT',
        label: paymentLinkDone ? 'Cobrança enviada' : 'Enviar link de pagamento',
        description: 'Gera e envia o link ao cliente.',
        icon: SendHorizontal,
        variant: paymentLinkDone ? 'outline' : 'default',
        disabled: paymentLinkDone || !canSendPaymentLink,
      },
    },
    {
      step: 3,
      label: 'Fechamento',
      title: 'Atualizar status do caso',
      description: !paymentLinkDone
        ? 'Disponivel depois que a Cobrança for enviada.'
        : item.status === 'PAID'
          ? 'Pagamento confirmado. Revise ou encerre o caso se precisar.'
          : 'Registre promessa, pagamento, pausa ou encerramento.',
      state: workflowStep === 3 ? 'CURRENT' : 'LOCKED',
      action: {
        key: 'STATUS',
        label: 'Atualizar status',
        description: 'Registra o resultado da Cobrança.',
        icon: CheckCircle2,
        disabled: !canUpdateStatus,
      },
    },
  ];

  const currentStep = steps.find((step) => step.state === 'CURRENT') ?? steps[0];

  let title = 'Comece pelo primeiro contato';
  let description = 'Aborde o cliente para abrir a conversa antes de avancar.';
  let summaryItems: RecoverySignal[] = [
    {
      label: 'Situação',
      value: 'Nenhuma mensagem enviada ainda.',
    },
    {
      label: 'Proximo passo',
      value: 'Enviar o primeiro contato ao cliente.',
    },
  ];

  if (workflowStep === 2) {
    title = paymentLinkDone ? 'Cobrança enviada' : 'Hora de enviar a Cobrança';
    description = paymentLinkDone
      ? 'O link ja foi enviado. Agora acompanhe a resposta e avance o status do caso.'
      : 'O contato ja foi feito. Agora envie o link de pagamento para seguir com a Cobrança.';
    summaryItems = [
      {
        label: 'Contato realizado',
        value: item.lastContactedAt
          ? `Mensagem enviada em ${formatDate(item.lastContactedAt)}.`
          : 'O cliente ja foi abordado.',
      },
      {
        label: 'Status da Cobrança',
        value: paymentLinkDone
          ? 'O link de pagamento ja foi enviado ao cliente.'
          : item.amountDue == null
            ? 'Falta valor configurado para liberar o link.'
            : 'Link ainda não enviado.',
      },
    ];
  }

  if (workflowStep === 3) {
    title = 'Fechamento do caso';
    description =
      'A Cobrança ja foi enviada. Agora atualize o status para registrar promessa, pagamento ou encerramento.';
    summaryItems = [
      {
        label: 'Cobrança enviada',
        value: item.paymentReference
          ? `referência ${item.paymentReference}.`
          : 'Link de pagamento enviado ao cliente.',
      },
      {
        label: 'Proximo passo',
        value:
          item.status === 'PAID'
            ? 'Pagamento confirmado.'
            : 'Atualize o status conforme a resposta ou pagamento do cliente.',
      },
    ];
  }

  return {
    workflowStep,
    title,
    description,
    summaryItems,
    steps,
    currentStep,
    showCurrentStepAction: item.status !== 'PAID',
  };
}

function runRecoveryAction(vm: RecoveryPageViewModel, actionKey: RecoveryActionKey) {
  if (actionKey === 'OUTREACH') {
    vm.setOutreachOpen(true);
    return;
  }

  if (actionKey === 'GUIDANCE') {
    vm.setGuidanceOpen(true);
    return;
  }

  if (actionKey === 'PAYMENT') {
    vm.setPaymentLinkOpen(true);
    return;
  }

  vm.setStatusOpen(true);
}

export function RecoveryCaseDetailSheet({ vm }: { vm: RecoveryPageViewModel }) {
  const item = vm.selectedCase;
  const canUseGuidance =
    item != null &&
    item.status !== 'PAID' &&
    item.status !== 'STOPPED' &&
    item.status !== 'INVALID_CONTACT';
  const hasSuggestion = Boolean(item?.suggestedReply?.trim());
  const guidanceAlreadySent = vm.guidanceAlreadySent;
  const guidanceHelperText = canUseGuidance
    ? guidanceAlreadySent
      ? 'A sugestão atual ja foi enviada ao cliente. Gere uma nova versao se precisar responder de outro jeito.'
      : 'A IA pode sugerir a melhor resposta com base na ultima mensagem do cliente.'
    : 'A sugestão fica indisponivel apenas para casos encerrados ou com contato invalido.';
  const contactDone = Boolean(item?.lastContactedAt);
  const playbookUiTitle =
    item?.playbookId && vm.playbooksQuery.data
      ? vm.playbooksQuery.data.find((p) => p.playbook.id === item.playbookId)?.playbook.name ??
        null
      : null;
  const playbookPhaseTotal =
    item?.playbookId && vm.playbooksQuery.data
      ? vm.playbooksQuery.data.find((p) => p.playbook.id === item.playbookId)?.phases.length
      : undefined;

  const allowAnotherOutreach = item
    ? !contactDone || recoveryPlaybookHasPendingPhases(item, vm.playbooksQuery.data)
    : false;

  const playbook = item
    ? buildRecoveryWorkflowUI(item, guidanceAlreadySent, allowAnotherOutreach)
    : null;
  const commercial = item ? getRecoveryCommercialContext(item) : null;
  const timelineItems =
    vm.timelineQuery.data?.entries?.length
      ? vm.timelineQuery.data.entries.map(mapContactTimelineEntryToVisual)
      : buildRecoveryFallbackMilestones(vm);
  const visibleAssignedTags = (item?.assignedTags ?? []).filter(
    (tag) => !tag.startsWith(INTERNAL_RECOVERY_TAG_PREFIX),
  );

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => !open && vm.closeCase()}>
      <SheetContent side="right" className="w-full border-l border-border/70 px-0 sm:max-w-4xl">
        {item ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="px-6 pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="text-xl">{item.debtorName}</SheetTitle>
                  <SheetDescription className="mt-2 flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4" />
                    {formatPhone(item.phone)}
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => vm.setRecurringOpen(true)}
                  >
                    <Repeat className="h-4 w-4" />
                    Recorrência
                  </Button>
                  {commercial ? (
                    <Badge
                      variant="outline"
                      className={getRecoveryCommercialToneClassName(commercial.tone)}
                    >
                      {commercial.kindLabel}
                    </Badge>
                  ) : null}
                  <StatusBadge status={item.status} className="shrink-0" />
                </div>
              </div>
            </SheetHeader>

            <div className="mt-6 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="glass-card border-border/60">
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        Empresa
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {item.debtorCompanyName || 'não informada'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        Documento
                      </p>
                      <p className="mt-2 text-sm text-foreground">
                        {item.debtorDocument || 'não informado'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {recoverySourceLabels[item.source] ?? item.source}
                      </Badge>
                      {item.referencePeriod ? (
                        <Badge variant="outline">Periodo {item.referencePeriod}</Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border-border/60">
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        Cobrança
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {item.chargeTitle || 'Titulo não informado'}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.chargeDescription || 'Sem descrição adicional'}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Valor
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {formatCurrency(item.amountDue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Vencimento
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {item.dueDate
                            ? new Date(item.dueDate).toLocaleDateString('pt-BR')
                            : 'não informado'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {commercial ? (
                <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={getRecoveryCommercialToneClassName(commercial.tone)}
                    >
                      {commercial.kindLabel}
                    </Badge>
                    <span className="font-medium text-foreground">{commercial.statusLabel}</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">{commercial.summary}</p>
                </div>
              ) : null}

              {item.playbookId ? (
                <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Roteiro automático (playbook)
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {playbookUiTitle ?? 'Playbook ligado ao caso'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Próximo envio pelo roteiro: fase {(item.playbookPhaseIndex ?? 0) + 1}
                    {playbookPhaseTotal != null ? ` de ${playbookPhaseTotal}` : ''}.
                    {item.lastPlaybookPhaseExecutedAt
                      ? ` Última fase enviada em ${formatDate(item.lastPlaybookPhaseExecutedAt)}.`
                      : ''}
                  </p>
                </div>
              ) : null}

              {item && playbook ? (
                <Card className="glass-card border-primary/15">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle className="text-base">Proxima etapa recomendada</CardTitle>
                        <p className="mt-2 text-sm text-muted-foreground">{playbook.description}</p>
                      </div>
                      <Badge variant="outline" className="w-fit">
                        Etapa {playbook.workflowStep} de 3
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      {playbook.steps.map((stepConfig) => {
                        const active = stepConfig.state === 'CURRENT';
                        const done = stepConfig.state === 'DONE';

                        return (
                          <div
                            key={stepConfig.label}
                            className={`rounded-2xl border px-4 py-3 ${active
                              ? 'border-primary/30 bg-primary/[0.08]'
                              : 'border-border/60 bg-muted/10'
                              }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                Etapa {stepConfig.step}
                              </p>
                              {active ? (
                                <Badge variant="outline" className="whitespace-nowrap text-[10px]">
                                  Atual
                                </Badge>
                              ) : done ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 whitespace-nowrap text-[10px]"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Concluida
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {stepConfig.label}
                            </p>
                            <p className="mt-2 break-words text-xs text-muted-foreground">
                              {stepConfig.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-sm font-semibold text-foreground">{playbook.title}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {playbook.currentStep.description}
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {playbook.summaryItems.map((summaryItem) => (
                          <div
                            key={summaryItem.label}
                            className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3"
                          >
                            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                              {summaryItem.label}
                            </p>
                            <p className="mt-2 break-words text-sm text-foreground">
                              {summaryItem.value}
                            </p>
                          </div>
                        ))}
                      </div>
                      {playbook.showCurrentStepAction ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            className="gap-1.5"
                            onClick={() => runRecoveryAction(vm, playbook.currentStep.action.key)}
                            disabled={playbook.currentStep.action.disabled}
                          >
                            <playbook.currentStep.action.icon className="h-4 w-4" />
                            {playbook.currentStep.action.label}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
                <Card className="glass-card border-border/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">Apoio da IA</CardTitle>
                        {guidanceAlreadySent ? (
                          <Badge
                            variant="outline"
                            className="border-success/20 bg-success/10 text-success"
                          >
                            sugestão enviada
                          </Badge>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={`gap-1.5 ${hasSuggestion ? '' : 'hidden'}`}
                        disabled={
                          vm.sendGuidanceMutation.isPending ||
                          guidanceAlreadySent
                        }
                        onClick={() => {
                          if (hasSuggestion) {
                            vm.sendGuidanceMutation.mutate();
                            return;
                          }

                          vm.setGuidanceOpen(true);
                        }}
                      >
                        {hasSuggestion ? (
                          <SendHorizontal className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {guidanceAlreadySent ? 'Enviada' : 'Enviar sugestão'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Resposta sugerida
                      </p>
                      <p className="mt-2 text-sm text-foreground">
                        {item.suggestedReply || 'Ainda não existe sugestão pronta para este caso.'}
                      </p>
                    </div>
                    {!hasSuggestion ? (
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        disabled={!canUseGuidance}
                        onClick={() => vm.setGuidanceOpen(true)}
                      >
                        <Sparkles className="h-4 w-4" />
                        Gerar sugestao
                      </Button>
                    ) : null}
                    <div className={`rounded-2xl border border-border/60 bg-muted/25 p-4 ${item.suggestedNextAction ? '' : 'hidden'}`}>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Proxima ação
                      </p>
                      <p className="mt-2 text-sm text-foreground">
                        {item.suggestedNextAction || 'Sem proxima ação sugerida no momento.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Timeline visual do caso</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {vm.timelineQuery.isLoading && item.contactId ? (
                      <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                        Carregando historico operacional deste cliente...
                      </div>
                    ) : timelineItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                        Ainda não ha eventos suficientes para compor a timeline deste caso.
                      </div>
                    ) : (
                      timelineItems.map((timelineItem, index) => (
                        <div
                          key={timelineItem.id}
                          className="relative rounded-2xl border border-border/60 px-4 py-3"
                        >
                          {index < timelineItems.length - 1 ? (
                            <div className="absolute left-[31px] top-14 h-[calc(100%-2.5rem)] w-px bg-border/60" />
                          ) : null}
                          <div className="flex items-start gap-3">
                            <div
                              className={`rounded-2xl p-2 ${timelineItem.tone.iconBgClassName}`}
                            >
                              <timelineItem.icon
                                className={`h-4 w-4 ${timelineItem.tone.iconClassName}`}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">
                                {timelineItem.title}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {timelineItem.timestamp
                                  ? formatDateTime(timelineItem.timestamp)
                                  : 'não informado'}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {timelineItem.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              {item.externalReference ||
                item.relatedEntityLabel ||
                item.relatedEntityType ||
                visibleAssignedTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {item.relatedEntityLabel || item.relatedEntityType ? (
                    <Badge variant="outline">
                      {item.relatedEntityLabel || item.relatedEntityType}
                    </Badge>
                  ) : null}
                  {item.externalReference ? (
                    <Badge variant="outline">Ref. {item.externalReference}</Badge>
                  ) : null}
                  {visibleAssignedTags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <Separator />

            <div className="px-6 py-4">
              <p className="text-xs text-muted-foreground">{guidanceHelperText}</p>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
