export interface MenuConditions {
  hasOperatingHours: boolean;
  hasPromotions: boolean;
  hasCatalogFiles: boolean;
  hasCatalogUrl: boolean;
  hasServices: boolean;
  hasSchedulingCategories: boolean;
  hasCommerceCatalog: boolean;
  hasRecoveryCases: boolean;
}

export interface OperatingHoursEntry {
  open: string;
  close: string;
  closed?: boolean;
}

export interface SchedulingCategorySummary {
  id: string;
  name: string;
}

export interface PromotionSummary {
  title: string;
  description: string;
  value: string;
}

export interface MenuConditionInput {
  operatingHours: Record<string, OperatingHoursEntry> | null;
  promotions: PromotionSummary[];
  catalogFiles: string[];
  catalogUrl: string | null;
  services: string | null;
  schedulingCategories: SchedulingCategorySummary[];
  commerceCatalogItemCount: number;
  hasRecoveryCases: boolean;
}

export class MenuConditionEvaluator {
  evaluate(input: MenuConditionInput): MenuConditions {
    return {
      hasOperatingHours: this.evaluateOperatingHours(input.operatingHours),
      hasPromotions: input.promotions.length > 0,
      hasCatalogFiles: input.catalogFiles.length > 0,
      hasCatalogUrl: !!input.catalogUrl,
      hasServices: !!input.services?.trim(),
      hasSchedulingCategories: input.schedulingCategories.length > 0,
      hasCommerceCatalog: input.commerceCatalogItemCount > 0,
      hasRecoveryCases: input.hasRecoveryCases,
    };
  }

  private evaluateOperatingHours(
    hours: Record<string, OperatingHoursEntry> | null,
  ): boolean {
    if (!hours) return false;

    const entries = Object.values(hours);
    if (entries.length === 0) return false;

    return entries.some((entry) => !entry.closed);
  }
}
