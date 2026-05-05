import { ProspectAdsInsightResultType } from '../entities/ProspectAdsInsightResult';

export interface GoogleAdsInsightItem {
  resultType: ProspectAdsInsightResultType;
  title: string;
  subtitle?: string;
  metricValue?: number;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface IGoogleAdsInsightsSource {
  generateInsights(input: {
    tenantId: string;
    segment: string;
    city?: string;
    state?: string;
    country?: string;
    ageRange?: string;
    gender?: string;
    interest?: string;
  }): Promise<GoogleAdsInsightItem[]>;
}

export const GOOGLE_ADS_INSIGHTS_SOURCE = Symbol('IGoogleAdsInsightsSource');
