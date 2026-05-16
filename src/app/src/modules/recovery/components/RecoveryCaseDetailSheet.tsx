import {
  CheckCircle2,
  MessageSquare,
  Repeat,
  Phone,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  formatCurrency as formatCurrencyValue,
  formatDateTime,
} from '@/shared/lib/formatters';
import { formatPhone } from '@/shared/lib/masks';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { recoverySourceLabels } from '@/modules/recovery/components/RecoveryLabel';
import { getRecoveryCommercialToneClassName } from '@/modules/recovery/utils/recovery-commercial';
import type { RecoveryPageViewModel } from '@/modules/recovery/view-models/useRecoveryPageViewModel';
import {
  useRecoveryCaseDetailViewModel,
  runRecoveryAction,
  type RecoveryCaseDetailViewModel,
} from '@/modules/recovery/view-models/useRecoveryCaseDetailViewModel';

// --- Formatters ---

function formatCurrency(value?: number) {
  return formatCurrencyValue(value) ?? '-';
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('pt-BR') : 'não informado';
}

// --- Sub-components ---

function DebtorInfoCard({ detail }: { detail: RecoveryCaseDetailViewModel }) {
  const { item } = detail;
  return (
    <Card className="glass-card border-border/60">
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Empresa</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {item.debtorCompanyName || 'Empresa não informada'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Documento</p>
          <p className="mt-1 text-sm text-foreground">
            {item.debtorDocument || 'não informado'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
            {recoverySourceLabels[item.source] ?? item.source}
          </Badge>
          {item.referencePeriod ? (
            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">Periodo {item.referencePeriod}</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ChargeInfoCard({ detail }: { detail: RecoveryCaseDetailViewModel }) {
  const { item } = detail;
  return (
    <Card className="glass-card border-border/60">
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cobrança</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {item.chargeTitle || 'Titulo não informado'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.chargeDescription || 'Sem descrição adicional'}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatCurrency(item.amountDue)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Vencimento</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {item.dueDate
                ? new Date(item.dueDate).toLocaleDateString('pt-BR')
                : 'não informado'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlaybookBanner({ detail }: { detail: RecoveryCaseDetailViewModel }) {
  const { item, playbookUiTitle, playbookPhaseTotal } = detail;
  if (!item.playbookId) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 text-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-primary">
        Roteiro automático
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {playbookUiTitle ?? 'Roteiro ligado ao caso'}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Próximo envio pelo roteiro: fase {(item.playbookPhaseIndex ?? 0) + 1}
        {playbookPhaseTotal != null ? ` de ${playbookPhaseTotal}` : ''}.
        {item.lastPlaybookPhaseExecutedAt
          ? ` Última fase enviada em ${formatDate(item.lastPlaybookPhaseExecutedAt)}.`
          : ''}
      </p>
    </div>
  );
}

function WorkflowCard({ detail, vm }: { detail: RecoveryCaseDetailViewModel; vm: RecoveryPageViewModel }) {
  const { workflow } = detail;

  return (
    <Card className="glass-card border-primary/15">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Proxima etapa recomendada</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{workflow.description}</p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-2.5 py-1 text-[11px]">
            Etapa {workflow.workflowStep} de 3
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {workflow.steps.map((stepConfig) => {
            const active = stepConfig.state === 'CURRENT';
            const done = stepConfig.state === 'DONE';

            return (
              <div
                key={stepConfig.label}
                className={`rounded-2xl border p-4 ${active
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border/60 bg-muted/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Etapa {stepConfig.step}
                  </p>
                  {active ? (
                    <Badge variant="outline" className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px]">
                      Atual
                    </Badge>
                  ) : done ? (
                    <Badge variant="outline" className="gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px]">
                      <CheckCircle2 className="h-3 w-3" />
                      Concluida
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {stepConfig.label}
                </p>
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  {stepConfig.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <p className="text-sm font-semibold text-foreground">{workflow.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {workflow.currentStep.description}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {workflow.summaryItems.map((summaryItem) => (
              <div
                key={summaryItem.label}
                className="rounded-2xl border border-border/60 bg-muted/10 p-4"
              >
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {summaryItem.label}
                </p>
                <p className="mt-1 break-words text-sm text-foreground">
                  {summaryItem.value}
                </p>
              </div>
            ))}
          </div>
          {workflow.showCurrentStepAction ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="gap-1.5"
                onClick={() => runRecoveryAction(vm, workflow.currentStep.action.key)}
                disabled={workflow.currentStep.action.disabled}
              >
                <workflow.currentStep.action.icon className="h-4 w-4" />
                {workflow.currentStep.action.label}
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function GuidanceCard({ detail, vm }: { detail: RecoveryCaseDetailViewModel; vm: RecoveryPageViewModel }) {
  const { item, hasSuggestion, hasClientInteraction, canGenerateGuidance, guidanceAlreadySent } = detail;

  return (
    <Card className="glass-card border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-sm font-semibold">Apoio da IA</CardTitle>
            {guidanceAlreadySent ? (
              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] border-success/20 bg-success/10 text-success">
                sugestão enviada
              </Badge>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`gap-1.5 ${hasSuggestion ? '' : 'hidden'}`}
            disabled={vm.sendGuidanceMutation.isPending || guidanceAlreadySent}
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
      <CardContent className="space-y-3">
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Resposta sugerida
          </p>
          <p className="mt-1 text-sm text-foreground">
            {item.suggestedReply || (hasClientInteraction
              ? 'Ainda não existe sugestão pronta para este caso.'
              : 'A sugestão será gerada após a primeira interação com o cliente.')}
          </p>
        </div>
        {!hasSuggestion ? (
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={!canGenerateGuidance}
            onClick={() => vm.setGuidanceOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            Gerar sugestão
          </Button>
        ) : null}
        {!hasClientInteraction && !hasSuggestion ? (
          <p className="text-xs text-muted-foreground">
            Disponível após a primeira interação com o cliente.
          </p>
        ) : null}
        <div className={`rounded-2xl border border-border/60 bg-muted/25 p-4 ${item.suggestedNextAction ? '' : 'hidden'}`}>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Proxima ação
          </p>
          <p className="mt-1 text-sm text-foreground">
            {item.suggestedNextAction || 'Sem proxima ação sugerida no momento.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineTab({ detail, vm }: { detail: RecoveryCaseDetailViewModel; vm: RecoveryPageViewModel }) {
  const { item, timelineItems } = detail;

  return (
    <Card className="glass-card border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Timeline do caso</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {vm.timelineQuery.isLoading && item.contactId ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
            Carregando histórico operacional deste cliente...
          </div>
        ) : timelineItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
            Ainda não há eventos suficientes para compor a timeline deste caso.
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
                <div className={`rounded-2xl p-2 ${timelineItem.tone.iconBgClassName}`}>
                  <timelineItem.icon className={`h-4 w-4 ${timelineItem.tone.iconClassName}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{timelineItem.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {timelineItem.timestamp ? formatDateTime(timelineItem.timestamp) : 'não informado'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{timelineItem.description}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TagsRow({ detail }: { detail: RecoveryCaseDetailViewModel }) {
  const { item, visibleAssignedTags } = detail;

  if (!item.externalReference && !item.relatedEntityLabel && !item.relatedEntityType && visibleAssignedTags.length === 0) {
    return null;
  }

  return (
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
        <Badge key={tag} variant="outline">{tag}</Badge>
      ))}
    </div>
  );
}

// --- Main Component ---

export function RecoveryCaseDetailSheet({ vm }: { vm: RecoveryPageViewModel }) {
  const detail = useRecoveryCaseDetailViewModel(vm);

  return (
    <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && vm.closeCase()}>
      <SheetContent side="right" className="w-full border-l border-border/60 px-0 sm:max-w-4xl">
        {detail ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="px-6 pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="text-xl">{detail.item.debtorName}</SheetTitle>
                  <SheetDescription className="mt-2 flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4" />
                    {formatPhone(detail.item.phone)}
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-2">
                  {detail.item.contactId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={vm.openConversationMutation.isPending}
                      onClick={() => vm.openConversationMutation.mutate(detail.item.contactId!)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Abrir conversa
                    </Button>
                  ) : null}
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
                  {detail.commercial ? (
                    <Badge
                      variant="outline"
                      className={getRecoveryCommercialToneClassName(detail.commercial.tone)}
                    >
                      {detail.commercial.kindLabel}
                    </Badge>
                  ) : null}
                  <StatusBadge status={detail.item.status} className="shrink-0" />
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="details" className="mt-6 flex-1 overflow-hidden flex flex-col">
              <TabsList className="mx-6 w-fit">
                <TabsTrigger value="details">Detalhes</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 overflow-y-auto px-6 pb-6 mt-4 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <DebtorInfoCard detail={detail} />
                  <ChargeInfoCard detail={detail} />
                </div>
                <PlaybookBanner detail={detail} />
                <WorkflowCard detail={detail} vm={vm} />
                <GuidanceCard detail={detail} vm={vm} />
                <TagsRow detail={detail} />
              </TabsContent>

              <TabsContent value="timeline" className="flex-1 overflow-y-auto px-6 pb-6 mt-4 space-y-4">
                <TimelineTab detail={detail} vm={vm} />
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="px-6 py-4">
              <p className="text-xs text-muted-foreground">{detail.guidanceHelperText}</p>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
