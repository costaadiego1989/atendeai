import { Injectable } from '@nestjs/common';
import { ProspectExecution } from '../../../domain/entities/ProspectExecution';
import { IProspectExecutionRepository } from '../../../domain/repositories/IProspectExecutionRepository';

@Injectable()
export class InMemoryProspectExecutionRepository implements IProspectExecutionRepository {
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
    return (
      matches.find((execution) => execution.status.value === 'PENDING') ?? null
    );
  }

  async findLastContactedAt(
    tenantId: string,
    contactId: string,
  ): Promise<Date | null> {
    const latest = await this.findLatestContactedByContact(tenantId, contactId);
    return latest?.updatedAt ?? null;
  }

  async findLatestByContactIds(
    tenantId: string,
    contactIds: string[],
  ): Promise<Array<{ contactId: string; status: string; updatedAt: Date; stopReason?: string | null; campaignName?: string }>> {
    const seen = new Map<string, { contactId: string; status: string; updatedAt: Date; stopReason?: string | null }>();

    for (const execution of this.executions.values()) {
      if (
        execution.tenantId.toString() !== tenantId ||
        !contactIds.includes(execution.contactId)
      ) {
        continue;
      }

      const existing = seen.get(execution.contactId);
      if (!existing || execution.updatedAt > existing.updatedAt) {
        seen.set(execution.contactId, {
          contactId: execution.contactId,
          status: execution.status.value,
          updatedAt: execution.updatedAt,
          stopReason: execution.stopReason?.value ?? null,
        });
      }
    }

    return [...seen.values()];
  }

  async findActiveByContact(
    tenantId: string,
    contactId: string,
  ): Promise<import('../../../domain/entities/ProspectExecution').ProspectExecution[]> {
    return [...this.executions.values()].filter(
      (e) =>
        e.tenantId.toString() === tenantId &&
        e.contactId === contactId &&
        ['PENDING', 'CONTACTED'].includes(e.status.value),
    );
  }

  async countContactedTodayByCampaign(
    tenantId: string,
    campaignId: string,
  ): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [...this.executions.values()].filter(
      (e) =>
        e.tenantId.toString() === tenantId &&
        e.campaignId.toString() === campaignId &&
        e.status.value === 'CONTACTED' &&
        e.updatedAt >= today,
    ).length;
  }
}
