export type CommercialTone = 'success' | 'warning' | 'info' | 'muted' | 'danger';

export type CommercialKind =
  | 'NEW_SALE'
  | 'RECOVERY'
  | 'CHECKOUT'
  | 'PAYMENT_LINK'
  | 'PROPOSAL';

export type CommercialEvidenceSource = string | null | undefined;

export type CommercialContext = {
  kind: CommercialKind;
  kindLabel: string;
  statusLabel: string;
  summary: string;
  tone: CommercialTone;
  channelLabel?: string;
  badgeLabel: string;
  confirmationLabel: string;
  isRecovery: boolean;
  isObjectiveEvidence: boolean;
};

type CreateCommercialContextInput = {
  kind: CommercialKind;
  kindLabel?: string;
  statusLabel: string;
  summary: string;
  tone: CommercialTone;
  evidenceSource?: CommercialEvidenceSource;
  channelLabel?: string;
  badgeLabel?: string;
  confirmationLabel?: string;
};

export function getCommercialKindLabel(kind: CommercialKind) {
  switch (kind) {
    case 'RECOVERY':
      return 'Receita recuperada';
    case 'CHECKOUT':
      return 'Nova venda';
    case 'PAYMENT_LINK':
      return 'Cobranca comercial';
    case 'PROPOSAL':
      return 'Proposta comercial';
    default:
      return 'Nova venda';
  }
}

export function getCommercialToneClassName(tone: CommercialTone) {
  switch (tone) {
    case 'success':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'info':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
    case 'danger':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
    default:
      return 'border-border/70 bg-background/70 text-muted-foreground';
  }
}

export function createCommercialContext(
  input: CreateCommercialContextInput,
): CommercialContext {
  const isRecovery = input.kind === 'RECOVERY';
  const isObjectiveEvidence = input.evidenceSource === 'PAYMENT_CONFIRMED';

  return {
    kind: input.kind,
    kindLabel: input.kindLabel ?? getCommercialKindLabel(input.kind),
    statusLabel: input.statusLabel,
    summary: input.summary,
    tone: input.tone,
    channelLabel: input.channelLabel,
    badgeLabel:
      input.badgeLabel ??
      (isRecovery ? 'Recovery confirmado' : 'Venda confirmada'),
    confirmationLabel:
      input.confirmationLabel ??
      (isObjectiveEvidence
        ? 'Confirmado por webhook de pagamento'
        : isRecovery
          ? 'Confirmado em recovery'
          : 'Confirmada pela IA'),
    isRecovery,
    isObjectiveEvidence,
  };
}
