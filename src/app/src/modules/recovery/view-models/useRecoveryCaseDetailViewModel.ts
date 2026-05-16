import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Send, SendHorizontal } from 'lucide-react';
import {
  getRecoveryCommercialContext,
} from '@/modules/recovery/utils/recovery-commercial';
import {
  buildRecoveryFallbackMilestones,
  mapContactTimelineEntryToVisual,
} from '@/modules/recovery/components/RecoveryTimelineHelper';
import { recoveryPlaybookHasPendingPhases } from '@/modules/recovery/view-models/useRecoveryViewModelHelper';
import type { RecoveryPageViewModel } from '@/modules/recovery/view-models/useRecoveryPageViewModel';

// --- Types ---

export type RecoveryActionKey = 'OUTREACH' | 'GUIDANCE' | 'PAYMENT' | 'STATUS';

export type RecoveryActionConfig = {
  key: RecoveryActionKey;
  label: string;
  description: string;
  icon: LucideIcon;
  variant?: 'default' | 'outline' | 'secondary';
  disabled?: boolean;
};

export type RecoverySignal = {
  label: string;
  value: string;
};

export type RecoveryWorkflowState = 'CURRENT' | 'DONE' | 'LOCKED';

export type RecoveryWorkflowStepConfig = {
  step: 1 | 2 | 3;
  label: string;
  title: string;
  description: string;
  state: RecoveryWorkflowState;
  action: RecoveryActionConfig;
};

export type RecoveryWorkflowUI = {
  workflowStep: number;
  title: string;
  description: string;
  summaryItems: RecoverySignal[];
  steps: RecoveryWorkflowStepConfig[];
  currentStep: RecoveryWorkflowStepConfig;
  showCurrentStepAction: boolean;
};

// --- Helpers ---

const INTERNAL_RECOVERY_TAG_PREFIX = 'system:';

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('pt-BR') : 'não informado';
}

function buildWorkflow(
  item: NonNullable<RecoveryPageViewModel['selectedCase']>,
  guidanceAlreadySent: boolean,
  allowAnotherOutreach: boolean,
): RecoveryWorkflowUI {
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
            ? `Última mensagem enviada em ${formatDate(item.lastContactedAt)}.`
            : 'O cliente já recebeu a primeira abordagem.'
          : contactDone && item.playbookId && allowAnotherOutreach
            ? 'Este caso segue um roteiro de cobrança: envie a próxima fase quando as regras de prazo forem atendidas.'
            : !contactDone
              ? 'Abra a conversa com o cliente antes de qualquer Cobrança.'
              : item.lastContactedAt
                ? `Última mensagem enviada em ${formatDate(item.lastContactedAt)}.`
                : 'O cliente já foi abordado.',
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
            ? 'Envia a mensagem da fase atual do roteiro (IA ou modelo).'
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
        ? 'Disponível depois que o contato for realizado.'
        : paymentLinkDone
          ? 'A Cobrança já foi enviada ao cliente.'
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
        ? 'Disponível depois que a Cobrança for enviada.'
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

  const currentStep = steps.find((s) => s.state === 'CURRENT') ?? steps[0];

  let title = 'Comece pelo primeiro contato';
  let description = 'Aborde o cliente para abrir a conversa antes de avançar.';
  let summaryItems: RecoverySignal[] = [
    { label: 'Situação', value: 'Nenhuma mensagem enviada ainda.' },
    { label: 'Próximo passo', value: 'Enviar o primeiro contato ao cliente.' },
  ];

  if (workflowStep === 2) {
    title = paymentLinkDone ? 'Cobrança enviada' : 'Hora de enviar a Cobrança';
    description = paymentLinkDone
      ? 'O link já foi enviado. Agora acompanhe a resposta e avance o status do caso.'
      : 'O contato já foi feito. Agora envie o link de pagamento para seguir com a Cobrança.';
    summaryItems = [
      {
        label: 'Contato realizado',
        value: item.lastContactedAt
          ? `Mensagem enviada em ${formatDate(item.lastContactedAt)}.`
          : 'O cliente já foi abordado.',
      },
      {
        label: 'Status da Cobrança',
        value: paymentLinkDone
          ? 'O link de pagamento já foi enviado ao cliente.'
          : item.amountDue == null
            ? 'Falta valor configurado para liberar o link.'
            : 'Link ainda não enviado.',
      },
    ];
  }

  if (workflowStep === 3) {
    title = 'Fechamento do caso';
    description =
      'A Cobrança já foi enviada. Agora atualize o status para registrar promessa, pagamento ou encerramento.';
    summaryItems = [
      {
        label: 'Cobrança enviada',
        value: item.paymentReference
          ? `referência ${item.paymentReference}.`
          : 'Link de pagamento enviado ao cliente.',
      },
      {
        label: 'Próximo passo',
        value:
          item.status === 'PAID'
            ? 'Pagamento confirmado.'
            : 'Atualize o status conforme a resposta ou pagamento do cliente.',
      },
    ];
  }

  return { workflowStep, title, description, summaryItems, steps, currentStep, showCurrentStepAction: item.status !== 'PAID' };
}

// --- Actions ---

export function runRecoveryAction(vm: RecoveryPageViewModel, actionKey: RecoveryActionKey) {
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

// --- View Model Hook ---

export function useRecoveryCaseDetailViewModel(vm: RecoveryPageViewModel) {
  const item = vm.selectedCase;
  const guidanceAlreadySent = vm.guidanceAlreadySent;

  return useMemo(() => {
    if (!item) {
      return null;
    }

    const canUseGuidance =
      item.status !== 'PAID' &&
      item.status !== 'STOPPED' &&
      item.status !== 'INVALID_CONTACT';
    const hasSuggestion = Boolean(item.suggestedReply?.trim());
    const hasClientInteraction = Boolean(item.lastContactedAt);
    const canGenerateGuidance = canUseGuidance && hasClientInteraction;
    const contactDone = Boolean(item.lastContactedAt);

    const guidanceHelperText = !hasClientInteraction
      ? 'A sugestão só pode ser gerada após a primeira interação com o cliente.'
      : canUseGuidance
        ? guidanceAlreadySent
          ? 'A sugestão atual já foi enviada ao cliente. Gere uma nova versão se precisar responder de outro jeito.'
          : 'A IA pode sugerir a melhor resposta com base na última mensagem do cliente.'
        : 'A sugestão fica indisponível apenas para casos encerrados ou com contato inválido.';

    const playbookUiTitle =
      item.playbookId && vm.playbooksQuery.data
        ? vm.playbooksQuery.data.find((p) => p.playbook.id === item.playbookId)?.playbook.name ?? null
        : null;

    const playbookPhaseTotal =
      item.playbookId && vm.playbooksQuery.data
        ? vm.playbooksQuery.data.find((p) => p.playbook.id === item.playbookId)?.phases.length
        : undefined;

    const allowAnotherOutreach = !contactDone || recoveryPlaybookHasPendingPhases(item, vm.playbooksQuery.data);

    const workflow = buildWorkflow(item, guidanceAlreadySent, allowAnotherOutreach);
    const commercial = getRecoveryCommercialContext(item);

    const timelineItems =
      vm.timelineQuery.data?.entries?.length
        ? vm.timelineQuery.data.entries.map(mapContactTimelineEntryToVisual)
        : buildRecoveryFallbackMilestones(vm);

    const visibleAssignedTags = (item.assignedTags ?? []).filter(
      (tag) => !tag.startsWith(INTERNAL_RECOVERY_TAG_PREFIX),
    );

    return {
      item,
      canUseGuidance,
      hasSuggestion,
      hasClientInteraction,
      canGenerateGuidance,
      guidanceAlreadySent,
      guidanceHelperText,
      contactDone,
      playbookUiTitle,
      playbookPhaseTotal,
      allowAnotherOutreach,
      workflow,
      commercial,
      timelineItems,
      visibleAssignedTags,
    };
  }, [item, guidanceAlreadySent, vm.playbooksQuery.data, vm.timelineQuery.data, vm]);
}

export type RecoveryCaseDetailViewModel = NonNullable<ReturnType<typeof useRecoveryCaseDetailViewModel>>;
