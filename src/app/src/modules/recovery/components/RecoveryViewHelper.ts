import type { RecoverySource, RecoveryStatus } from '@/shared/types';
import { recoverySourceLabels, recoveryStatusLabels } from './RecoveryLabel';

export const RECOVERY_STATUS_OPTIONS: Array<{
  value: 'ALL' | RecoveryStatus;
  label: string;
}> = [
  { value: 'ALL', label: 'Todos os status' },
  { value: 'READY_TO_CONTACT', label: recoveryStatusLabels.READY_TO_CONTACT },
  { value: 'CONTACTED', label: recoveryStatusLabels.CONTACTED },
  { value: 'NEGOTIATING', label: recoveryStatusLabels.NEGOTIATING },
  { value: 'PROMISE_TO_PAY', label: recoveryStatusLabels.PROMISE_TO_PAY },
  { value: 'PAID', label: recoveryStatusLabels.PAID },
  { value: 'NO_RESPONSE', label: recoveryStatusLabels.NO_RESPONSE },
  { value: 'INVALID_CONTACT', label: recoveryStatusLabels.INVALID_CONTACT },
  { value: 'STOPPED', label: recoveryStatusLabels.STOPPED },
];

export const RECOVERY_SOURCE_OPTIONS: Array<{
  value: 'ALL' | RecoverySource;
  label: string;
}> = [
  { value: 'ALL', label: 'Todas as origens' },
  { value: 'CRM', label: recoverySourceLabels.CRM },
  { value: 'MANUAL', label: recoverySourceLabels.MANUAL },
  { value: 'IMPORT', label: recoverySourceLabels.IMPORT },
];
