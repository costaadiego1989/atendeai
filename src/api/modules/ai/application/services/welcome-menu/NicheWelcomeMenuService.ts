import { Injectable } from '@nestjs/common';
import { NicheClassifier, NicheCategory } from './NicheClassifier';
import {
  MenuConditionEvaluator,
  MenuConditionInput,
  SchedulingCategorySummary,
  PromotionSummary,
  OperatingHoursEntry,
} from './MenuConditionEvaluator';
import { IMenuBuilder, MenuBuilderInput } from './builders/IMenuBuilder';
import { CommerceMenuBuilder } from './builders/CommerceMenuBuilder';
import { SchedulingMenuBuilder } from './builders/SchedulingMenuBuilder';
import { RecoveryMenuBuilder } from './builders/RecoveryMenuBuilder';
import { ConsultativeMenuBuilder } from './builders/ConsultativeMenuBuilder';
import { EducationMenuBuilder } from './builders/EducationMenuBuilder';
import { B2BMenuBuilder } from './builders/B2BMenuBuilder';
import { DefaultMenuBuilder } from './builders/DefaultMenuBuilder';
import {
  formatGreeting,
  getToneDescription,
  MENU_INSTRUCTIONS_TEMPLATE,
} from './NicheMenuTemplates';

export interface NicheWelcomeMenuInput {
  companyName: string;
  businessType: string | null;
  operatingHours: Record<string, OperatingHoursEntry> | null;
  promotions: PromotionSummary[];
  catalogFiles: string[];
  catalogUrl: string | null;
  services: string | null;
  schedulingCategories: SchedulingCategorySummary[];
  commerceCatalogItemCount: number;
  hasRecoveryCases: boolean;
}

@Injectable()
export class NicheWelcomeMenuService {
  private readonly classifier: NicheClassifier;
  private readonly conditionEvaluator: MenuConditionEvaluator;
  private readonly builders: IMenuBuilder[];

  constructor() {
    this.classifier = new NicheClassifier();
    this.conditionEvaluator = new MenuConditionEvaluator();
    this.builders = [
      new CommerceMenuBuilder(),
      new SchedulingMenuBuilder(),
      new RecoveryMenuBuilder(),
      new ConsultativeMenuBuilder(),
      new EducationMenuBuilder(),
      new B2BMenuBuilder(),
      new DefaultMenuBuilder(),
    ];
  }

  buildWelcomePrompt(input: NicheWelcomeMenuInput): string {
    const { category } = this.classifier.classify(input.businessType);

    const conditions = this.conditionEvaluator.evaluate(
      this.toConditionInput(input),
    );

    const menuContent = this.buildMenu(category, input, conditions);

    const greeting = formatGreeting(category, input.companyName);
    const tone = getToneDescription(category);

    return this.assemblePrompt(greeting, menuContent, tone);
  }

  private buildMenu(
    category: NicheCategory,
    input: NicheWelcomeMenuInput,
    conditions: ReturnType<MenuConditionEvaluator['evaluate']>,
  ): string {
    const builderInput: MenuBuilderInput = {
      companyName: input.companyName,
      category,
      conditions,
      businessType: input.businessType,
    };

    const builder = this.builders.find((b) => b.supports(category));
    if (!builder) {
      const fallback = this.builders.find((b) => b.supports('DEFAULT'))!;
      return fallback.build(builderInput);
    }

    return builder.build(builderInput);
  }

  private toConditionInput(input: NicheWelcomeMenuInput): MenuConditionInput {
    return {
      operatingHours: input.operatingHours,
      promotions: input.promotions,
      catalogFiles: input.catalogFiles,
      catalogUrl: input.catalogUrl,
      services: input.services,
      schedulingCategories: input.schedulingCategories,
      commerceCatalogItemCount: input.commerceCatalogItemCount,
      hasRecoveryCases: input.hasRecoveryCases,
    };
  }

  private assemblePrompt(greeting: string, menu: string, tone: string): string {
    return `[MENU DE BOAS-VINDAS]:
Ao receber a primeira mensagem do cliente, apresente uma saudação breve e amigável seguida do menu abaixo. Adapte o tom ao nicho.

Saudação: ${greeting}

${menu}
0️⃣ Voltar ao menu principal

${MENU_INSTRUCTIONS_TEMPLATE}
- Tom: ${tone}`;
  }
}
