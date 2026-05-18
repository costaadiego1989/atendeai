import { MenuConditions } from '../MenuConditionEvaluator';
import { NicheCategory } from '../NicheClassifier';

export interface MenuBuilderInput {
  companyName: string;
  category: NicheCategory;
  conditions: MenuConditions;
  businessType?: string | null;
}

export interface IMenuBuilder {
  supports(category: NicheCategory): boolean;
  build(input: MenuBuilderInput): string;
}
