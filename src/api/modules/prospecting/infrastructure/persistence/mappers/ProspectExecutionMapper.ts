import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { TenantId } from '@shared/domain/TenantId';
import { ProspectExecution } from '../../../domain/entities/ProspectExecution';
import { ProspectChannelVO } from '../../../domain/value-objects/ProspectChannel';
import { ProspectExecutionStatusVO } from '../../../domain/value-objects/ProspectExecutionStatus';
import { ProspectStopReasonVO } from '../../../domain/value-objects/ProspectStopReason';

interface RawProspectExecution {
  id: string;
  tenant_id: string;
  campaign_id: string;
  contact_id: string;
  channel: string;
  status: string;
  attempt_count: number;
  stop_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class ProspectExecutionMapper {
  public static toDomain(raw: RawProspectExecution): ProspectExecution {
    return ProspectExecution.reconstitute(
      {
        tenantId: TenantId.create(raw.tenant_id),
        campaignId: new UniqueEntityID(raw.campaign_id),
        contactId: raw.contact_id,
        channel: ProspectChannelVO.create(raw.channel),
        status: ProspectExecutionStatusVO.create(raw.status),
        attemptCount: raw.attempt_count,
        stopReason: raw.stop_reason
          ? ProspectStopReasonVO.create(raw.stop_reason)
          : undefined,
      },
      new UniqueEntityID(raw.id),
      new Date(raw.created_at),
      new Date(raw.updated_at),
    );
  }

  public static toPersistence(execution: ProspectExecution) {
    return {
      id: execution.id.toString(),
      tenantId: execution.tenantId.toString(),
      campaignId: execution.campaignId.toString(),
      contactId: execution.contactId,
      channel: execution.channel.value,
      status: execution.status.value,
      attemptCount: execution.attemptCount,
      stopReason: execution.stopReason?.value ?? null,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    };
  }
}
