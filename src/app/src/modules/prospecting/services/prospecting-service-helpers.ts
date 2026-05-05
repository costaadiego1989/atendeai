import type {
  Campaign,
  ProspectCampaignAudienceType,
  ProspectCampaignChannel,
  ProspectResult,
  ProspectSearch,
} from '@/shared/types';

export function toIso(value?: string | Date) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

export function withBranchQuery(path: string, branchId?: string | null) {
  if (!branchId) {
    return path;
  }

  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}branchId=${encodeURIComponent(branchId)}`;
}

export function mapSearch(search: {
  id: string;
  tenantId?: string;
  businessTypeQuery: string;
  city: string;
  state?: string;
  neighborhood?: string;
  source: 'GOOGLE_PLACES';
  maxResults: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  discoveredCount: number;
  failureReason?: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
}): ProspectSearch {
  return {
    id: search.id,
    tenantId: search.tenantId,
    businessTypeQuery: search.businessTypeQuery,
    city: search.city,
    state: search.state,
    neighborhood: search.neighborhood,
    source: search.source,
    maxResults: search.maxResults,
    status: search.status,
    discoveredCount: search.discoveredCount,
    failureReason: search.failureReason,
    createdAt: toIso(search.createdAt),
    updatedAt: toIso(search.updatedAt ?? search.createdAt),
  };
}

export function mapResult(result: {
  id: string;
  searchId: string;
  source: 'GOOGLE_PLACES';
  externalId?: string;
  businessName: string;
  city: string;
  state?: string;
  phone?: string;
  whatsappPhone?: string;
  instagramUrl?: string;
  email?: string;
  website?: string;
  createdAt: string | Date;
}): ProspectResult {
  return {
    id: result.id,
    searchId: result.searchId,
    source: result.source,
    externalId: result.externalId,
    businessName: result.businessName,
    city: result.city,
    state: result.state,
    phone: result.phone,
    whatsappPhone: result.whatsappPhone,
    instagramUrl: result.instagramUrl,
    email: result.email,
    website: result.website,
    createdAt: toIso(result.createdAt),
  };
}

export function mapCampaign(campaign: {
  id: string;
  tenantId?: string;
  name: string;
  objective: string;
  audienceType: ProspectCampaignAudienceType;
  channel: ProspectCampaignChannel;
  targetContactIds: string[];
  messageTemplate?: string;
  dailyLimit: number;
  status: Campaign['status'];
  createdAt: string | Date;
}): Campaign {
  return {
    id: campaign.id,
    tenantId: campaign.tenantId,
    name: campaign.name,
    objective: campaign.objective,
    audienceType: campaign.audienceType,
    channel: campaign.channel,
    targetContactIds: campaign.targetContactIds,
    messageTemplate: campaign.messageTemplate,
    dailyLimit: campaign.dailyLimit,
    status: campaign.status,
    createdAt: toIso(campaign.createdAt),
  };
}
