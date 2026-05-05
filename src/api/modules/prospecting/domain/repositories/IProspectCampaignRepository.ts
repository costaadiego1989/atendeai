import { ProspectCampaign } from '../entities/ProspectCampaign';

export interface IProspectCampaignRepository {
  save(campaign: ProspectCampaign): Promise<void>;
  findById(tenantId: string, id: string): Promise<ProspectCampaign | null>;
  findAllByTenant(tenantId: string): Promise<ProspectCampaign[]>;
}

export const PROSPECT_CAMPAIGN_REPOSITORY = Symbol(
  'IProspectCampaignRepository',
);
