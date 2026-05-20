import { AutomationEntity, AutomationExecution } from '../../domain/entities/Automation';

export const AUTOMATION_REPOSITORY = Symbol('AUTOMATION_REPOSITORY');

export interface IAutomationRepository {
  findById(tenantId: string, id: string): Promise<AutomationEntity | null>;
  findAllByTenant(tenantId: string, onlyActive?: boolean): Promise<AutomationEntity[]>;
  findByTriggerType(tenantId: string, triggerType: string): Promise<AutomationEntity[]>;
  create(data: Omit<AutomationEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<AutomationEntity>;
  update(tenantId: string, id: string, data: Partial<AutomationEntity>): Promise<AutomationEntity>;
  delete(tenantId: string, id: string): Promise<void>;
  toggleActive(tenantId: string, id: string, isActive: boolean): Promise<void>;
}

export const AUTOMATION_EXECUTION_REPOSITORY = Symbol('AUTOMATION_EXECUTION_REPOSITORY');

export interface IAutomationExecutionRepository {
  create(data: Omit<AutomationExecution, 'id' | 'startedAt'>): Promise<AutomationExecution>;
  findById(id: string): Promise<AutomationExecution | null>;
  updateStatus(id: string, status: string, error?: string): Promise<void>;
  updateStep(id: string, currentStep: number, context?: Record<string, unknown>): Promise<void>;
  findByAutomation(tenantId: string, automationId: string, limit?: number): Promise<AutomationExecution[]>;
  findRunning(tenantId: string): Promise<AutomationExecution[]>;
  cancel(id: string): Promise<void>;
}
