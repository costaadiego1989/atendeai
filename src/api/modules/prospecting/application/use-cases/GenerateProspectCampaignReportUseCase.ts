import { Inject, Injectable } from '@nestjs/common';
import {
  IProspectCampaignRepository,
  PROSPECT_CAMPAIGN_REPOSITORY,
} from '../../domain/repositories/IProspectCampaignRepository';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../../domain/repositories/IProspectExecutionRepository';

export type GenerateProspectCampaignReportInput = {
  tenantId: string;
  query?: string;
  statuses?: Array<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'>;
  channels?: Array<'WHATSAPP' | 'INSTAGRAM'>;
  audienceTypes?: Array<'REENGAGEMENT' | 'CONTACT_LIST'>;
  dateFrom?: string;
  dateTo?: string;
};

export type ProspectCampaignReportRow = {
  campaignId: string;
  name: string;
  objective: string;
  audienceType: 'REENGAGEMENT' | 'CONTACT_LIST';
  channel: 'WHATSAPP' | 'INSTAGRAM';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  dailyLimit: number;
  targetContactsCount: number;
  executionsCount: number;
  pendingExecutions: number;
  contactedExecutions: number;
  respondedExecutions: number;
  stoppedExecutions: number;
  failedExecutions: number;
  createdAt: string;
  updatedAt: string;
};

export type GenerateProspectCampaignReportOutput = {
  generatedAt: Date;
  summary: {
    totalCampaigns: number;
    activeCampaigns: number;
    draftCampaigns: number;
    pausedCampaigns: number;
    totalAudience: number;
    totalExecutions: number;
    contactedExecutions: number;
    respondedExecutions: number;
    failedExecutions: number;
  };
  rows: ProspectCampaignReportRow[];
};

@Injectable()
export class GenerateProspectCampaignReportUseCase {
  constructor(
    @Inject(PROSPECT_CAMPAIGN_REPOSITORY)
    private readonly prospectCampaignRepository: IProspectCampaignRepository,
    @Inject(PROSPECT_EXECUTION_REPOSITORY)
    private readonly prospectExecutionRepository: IProspectExecutionRepository,
  ) {}

  async execute(
    input: GenerateProspectCampaignReportInput,
  ): Promise<GenerateProspectCampaignReportOutput> {
    const campaigns = await this.prospectCampaignRepository.findAllByTenant(
      input.tenantId,
    );
    const statusFilters = new Set((input.statuses ?? []).filter(Boolean));
    const channelFilters = new Set((input.channels ?? []).filter(Boolean));
    const audienceFilters = new Set(
      (input.audienceTypes ?? []).filter(Boolean),
    );
    const normalizedQuery = input.query?.trim().toLowerCase() ?? '';
    const startAt = this.toStartDate(input.dateFrom);
    const endAt = this.toEndDate(input.dateTo);

    const filteredCampaigns = campaigns.filter((campaign) => {
      const matchesStatus =
        statusFilters.size === 0 || statusFilters.has(campaign.status.value);
      const matchesChannel =
        channelFilters.size === 0 || channelFilters.has(campaign.channel.value);
      const matchesAudience =
        audienceFilters.size === 0 ||
        audienceFilters.has(campaign.audienceType.value);
      const matchesQuery =
        !normalizedQuery ||
        [campaign.name, campaign.objective]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesDate = this.isWithinRange(
        campaign.createdAt,
        startAt,
        endAt,
      );

      return (
        matchesStatus &&
        matchesChannel &&
        matchesAudience &&
        matchesQuery &&
        matchesDate
      );
    });

    const rows = await Promise.all(
      filteredCampaigns.map(async (campaign) => {
        const executions =
          await this.prospectExecutionRepository.findAllByCampaign(
            input.tenantId,
            campaign.id.toString(),
          );

        return {
          campaignId: campaign.id.toString(),
          name: campaign.name,
          objective: campaign.objective,
          audienceType: campaign.audienceType.value,
          channel: campaign.channel.value,
          status: campaign.status.value,
          dailyLimit: campaign.dailyLimit,
          targetContactsCount: campaign.targetContactIds.length,
          executionsCount: executions.length,
          pendingExecutions: executions.filter(
            (item) => item.status.value === 'PENDING',
          ).length,
          contactedExecutions: executions.filter(
            (item) => item.status.value === 'CONTACTED',
          ).length,
          respondedExecutions: executions.filter(
            (item) => item.status.value === 'RESPONDED',
          ).length,
          stoppedExecutions: executions.filter(
            (item) => item.status.value === 'STOPPED',
          ).length,
          failedExecutions: executions.filter(
            (item) => item.status.value === 'FAILED',
          ).length,
          createdAt: campaign.createdAt.toISOString(),
          updatedAt: campaign.updatedAt.toISOString(),
        } satisfies ProspectCampaignReportRow;
      }),
    );

    return {
      generatedAt: new Date(),
      summary: {
        totalCampaigns: rows.length,
        activeCampaigns: rows.filter((row) => row.status === 'ACTIVE').length,
        draftCampaigns: rows.filter((row) => row.status === 'DRAFT').length,
        pausedCampaigns: rows.filter((row) => row.status === 'PAUSED').length,
        totalAudience: rows.reduce(
          (total, row) => total + row.targetContactsCount,
          0,
        ),
        totalExecutions: rows.reduce(
          (total, row) => total + row.executionsCount,
          0,
        ),
        contactedExecutions: rows.reduce(
          (total, row) => total + row.contactedExecutions,
          0,
        ),
        respondedExecutions: rows.reduce(
          (total, row) => total + row.respondedExecutions,
          0,
        ),
        failedExecutions: rows.reduce(
          (total, row) => total + row.failedExecutions,
          0,
        ),
      },
      rows,
    };
  }

  private toStartDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    return new Date(`${value}T00:00:00.000Z`);
  }

  private toEndDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    return new Date(`${value}T23:59:59.999Z`);
  }

  private isWithinRange(value: Date, startAt: Date | null, endAt: Date | null) {
    if (startAt && value < startAt) {
      return false;
    }
    if (endAt && value > endAt) {
      return false;
    }
    return true;
  }
}
