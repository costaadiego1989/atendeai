import type { RecoveryAsyncJob, RecoveryCase, RecoveryStatus } from '@/shared/types';
import type {
  RecoveryBillingType,
  RecoveryPlaybookWithPhases,
} from '@/modules/recovery/services/RecoveryService';

export const RECOVERY_GUIDANCE_SENT_TAG = 'system:guidance_sent';
export const RECOVERY_PAGE_SIZE = 20;

export const DEFAULT_CREATE_FORM = {
  contactId: '',
  debtorName: '',
  phone: '',
  debtorCompanyName: '',
  debtorDocument: '',
  chargeType: '',
  chargeTitle: '',
  chargeDescription: '',
  referencePeriod: '',
  relatedEntityType: '',
  relatedEntityId: '',
  relatedEntityLabel: '',
  amountDue: '',
  dueDate: '',
  externalReference: '',
  assignedTagsText: '',
};

export const DEFAULT_OUTREACH_FORM = {
  messageText: '',
  previewText: '',
  previewGeneratedWithAI: false,
  outreachMode: 'free' as 'free' | 'playbook',
};

export const DEFAULT_GUIDANCE_FORM = {
  customerMessage: '',
};

export const DEFAULT_PAYMENT_LINK_FORM = {
  billingType: 'PIX' as RecoveryBillingType,
};

export const DEFAULT_STATUS_FORM = {
  status: 'CONTACTED' as RecoveryStatus,
  nextActionAt: '',
};

export const DEFAULT_REPORT_FILTERS = {
  search: '',
  statuses: [] as RecoveryStatus[],
  sources: [] as Array<'CRM' | 'MANUAL' | 'IMPORT'>,
};

export function recoveryPlaybookHasPendingPhases(
  recoveryCase: Pick<RecoveryCase, 'playbookId' | 'playbookPhaseIndex'> | null | undefined,
  playbooks: RecoveryPlaybookWithPhases[] | undefined,
): boolean {
  if (!recoveryCase?.playbookId) {
    return false;
  }
  if (!playbooks?.length) {
    return true;
  }
  const entry = playbooks.find((p) => p.playbook.id === recoveryCase.playbookId);
  if (!entry) {
    return true;
  }
  return (recoveryCase.playbookPhaseIndex ?? 0) < entry.phases.length;
}

/** Indica se não há mais envios de “primeiro contato” esperados (sem fases pendentes no playbook). */
export function recoveryOutreachFlowExhausted(
  recoveryCase:
    | Pick<RecoveryCase, 'lastContactedAt' | 'playbookId' | 'playbookPhaseIndex'>
    | null
    | undefined,
  playbooks: RecoveryPlaybookWithPhases[] | undefined,
): boolean {
  if (!recoveryCase?.lastContactedAt) {
    return false;
  }
  if (recoveryPlaybookHasPendingPhases(recoveryCase, playbooks)) {
    return false;
  }
  return true;
}

export type RecoveryPeriodFilter = 'today' | '7d' | '30d';

export const RECOVERY_PERIOD_OPTIONS: Array<{
  value: RecoveryPeriodFilter;
  label: string;
  description: string;
}> = [
  { value: 'today', label: 'Hoje', description: 'Casos movimentados hoje' },
  { value: '7d', label: '7 dias', description: 'Casos movimentados nos ultimos 7 dias' },
  { value: '30d', label: '30 dias', description: 'Casos movimentados nos ultimos 30 dias' },
];

export function buildRecoveryPeriodRange(period: RecoveryPeriodFilter) {
  const now = new Date();
  const dateFrom = new Date(now);

  if (period === 'today') {
    dateFrom.setHours(0, 0, 0, 0);
  } else if (period === '7d') {
    dateFrom.setDate(dateFrom.getDate() - 7);
  } else {
    dateFrom.setDate(dateFrom.getDate() - 30);
  }

  return {
    dateFrom: dateFrom.toISOString(),
    dateTo: now.toISOString(),
  };
}

export function sortRecoveryCases<T extends Pick<RecoveryCase, 'status' | 'dueDate' | 'updatedAt'>>(
  cases: T[],
) {
  return [...cases].sort((left, right) => {
    const leftOpen = left.status !== 'PAID' && left.status !== 'STOPPED';
    const rightOpen = right.status !== 'PAID' && right.status !== 'STOPPED';

    if (leftOpen !== rightOpen) {
      return leftOpen ? -1 : 1;
    }

    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;

    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export function matchesRecoverySearch(
  recoveryCase: Pick<
    RecoveryCase,
    | 'debtorName'
    | 'debtorCompanyName'
    | 'phone'
    | 'chargeTitle'
    | 'chargeDescription'
    | 'relatedEntityLabel'
    | 'externalReference'
  >,
  term: string,
) {
  if (!term) {
    return true;
  }

  const haystack = [
    recoveryCase.debtorName,
    recoveryCase.debtorCompanyName,
    recoveryCase.phone,
    recoveryCase.chargeTitle,
    recoveryCase.chargeDescription,
    recoveryCase.relatedEntityLabel,
    recoveryCase.externalReference,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(term);
}

export function splitRecoveryTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function buildRecoverySummary(cases: RecoveryCase[]) {
  const openCases = cases.filter((item) => item.status !== 'PAID' && item.status !== 'STOPPED');
  const paidCases = cases.filter((item) => item.status === 'PAID');
  const promiseCases = cases.filter((item) => item.status === 'PROMISE_TO_PAY');
  const guidanceCount = cases.filter((item) => Boolean(item.suggestedReply)).length;

  const openAmount = openCases.reduce((total, item) => total + (item.amountDue ?? 0), 0);
  const paidAmount = paidCases.reduce((total, item) => total + (item.amountDue ?? 0), 0);

  return {
    openCount: openCases.length,
    promiseCount: promiseCases.length,
    paidCount: paidCases.length,
    guidanceCount,
    openAmount,
    paidAmount,
  };
}

export function isActiveRecoveryJob(job?: RecoveryAsyncJob | null) {
  return job?.status === 'QUEUED' || job?.status === 'PROCESSING';
}
