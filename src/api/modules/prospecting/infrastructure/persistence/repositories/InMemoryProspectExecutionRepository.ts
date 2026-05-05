import { Injectable } from '@nestjs/common';
import { ProspectExecution } from '../../../domain/entities/ProspectExecution';
import { IProspectExecutionRepository } from '../../../domain/repositories/IProspectExecutionRepository';

@Injectable()
export class InMemoryProspectExecutionRepository
  implements IProspectExecutionRepository
{
  private readonly executions = new Map<string, ProspectExecution>();

  async save(execution: ProspectExecution): Promise<void> {
    this.executions.set(execution.id.toString(), execution);
  }

  async saveMany(executions: ProspectExecution[]): Promise<void> {
    for (const execution of executions) {
      this.executions.set(execution.id.toString(), execution);
    }
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<ProspectExecution | null> {
    const execution = this.executions.get(id);

    if (!execution || execution.tenantId.toString() !== tenantId) {
      return null;
    }

    return execution;
  }

  async findLatestContactedByContact(
    tenantId: string,
    contactId: string,
  ): Promise<ProspectExecution | null> {
    const matches = [...this.executions.values()]
      .filter(
        (execution) =>
          execution.tenantId.toString() === tenantId &&
          execution.contactId === contactId &&
          execution.status.value === 'CONTACTED',
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return matches[0] ?? null;
  }

  async findAllByCampaign(
    tenantId: string,
    campaignId: string,
  ): Promise<ProspectExecution[]> {
    return [...this.executions.values()].filter(
      (execution) =>
        execution.tenantId.toString() === tenantId &&
        execution.campaignId.toString() === campaignId,
    );
  }

  async findNextPendingByCampaign(
    tenantId: string,
    campaignId: string,
  ): Promise<ProspectExecution | null> {
    const matches = await this.findAllByCampaign(tenantId, campaignId);
    return matches.find((execution) => execution.status.value === 'PENDING') ?? null;
  }
}
