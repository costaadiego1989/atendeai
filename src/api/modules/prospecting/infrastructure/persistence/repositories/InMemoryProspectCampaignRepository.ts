import { Injectable } from '@nestjs/common';
import { ProspectCampaign } from '../../../domain/entities/ProspectCampaign';
import { IProspectCampaignRepository } from '../../../domain/repositories/IProspectCampaignRepository';

@Injectable()
export class InMemoryProspectCampaignRepository implements IProspectCampaignRepository {
  private readonly campaigns = new Map<string, ProspectCampaign>();

  async save(campaign: ProspectCampaign): Promise<void> {
    this.campaigns.set(campaign.id.toString(), campaign);
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<ProspectCampaign | null> {
    const campaign = this.campaigns.get(id);

    if (!campaign || campaign.tenantId.toString() !== tenantId) {
      return null;
    }

    return campaign;
  }

  async findAllByTenant(tenantId: string): Promise<ProspectCampaign[]> {
    return [...this.campaigns.values()].filter(
      (campaign) => campaign.tenantId.toString() === tenantId,
    );
  }
}
