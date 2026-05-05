export interface ProspectWebsiteEnrichment {
  email?: string;
  phone?: string;
  whatsappPhone?: string;
  instagramUrl?: string;
}

export interface IProspectWebsiteEnricher {
  enrich(input: { website?: string }): Promise<ProspectWebsiteEnrichment>;
}

export const PROSPECT_WEBSITE_ENRICHER = Symbol('IProspectWebsiteEnricher');
