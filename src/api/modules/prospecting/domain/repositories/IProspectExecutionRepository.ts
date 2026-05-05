import { ProspectExecution } from '../entities/ProspectExecution';

export interface IProspectExecutionRepository {
  save(execution: ProspectExecution): Promise<void>;
  saveMany(executions: ProspectExecution[]): Promise<void>;
  findById(tenantId: string, id: string): Promise<ProspectExecution | null>;
  findLatestContactedByContact(
    tenantId: string,
    contactId: string,
  ): Promise<ProspectExecution | null>;
  findAllByCampaign(
    tenantId: string,
    campaignId: string,
  ): Promise<ProspectExecution[]>;
  findNextPendingByCampaign(
    tenantId: string,
    campaignId: string,
  ): Promise<ProspectExecution | null>;
}

export const PROSPECT_EXECUTION_REPOSITORY = Symbol(
  'IProspectExecutionRepository',
);
