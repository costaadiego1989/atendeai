import { TriggerConfig } from '../value-objects/TriggerType';

export interface AutomationStep {
  id: string;
  automationId: string;
  order: number;
  type: string;
  config: Record<string, unknown>;
  nextStepId?: string | null;
}

export interface AutomationEntity {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  trigger: TriggerConfig;
  conditions: Record<string, unknown>[];
  steps: AutomationStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationExecution {
  id: string;
  automationId: string;
  tenantId: string;
  contactId?: string | null;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  currentStep: number;
  context: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date | null;
  error?: string | null;
}
