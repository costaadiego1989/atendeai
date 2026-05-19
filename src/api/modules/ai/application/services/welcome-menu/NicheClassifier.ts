export type NicheCategory =
  | 'RETAIL'
  | 'ECOMMERCE'
  | 'FOOD'
  | 'HEALTH'
  | 'BEAUTY'
  | 'RECOVERY'
  | 'HOME_SERV'
  | 'EDUCATION'
  | 'B2B'
  | 'DEFAULT';

export type NicheStrategy =
  | 'COMMERCE'
  | 'SCHEDULING'
  | 'RECOVERY'
  | 'CONSULTATIVE';

export interface NicheClassification {
  category: NicheCategory;
  strategy: NicheStrategy;
}

const BUSINESS_TYPE_TO_CATEGORY: Record<string, NicheCategory> = {
  RETAIL: 'RETAIL',
  ECOMMERCE: 'ECOMMERCE',
  FOOD: 'FOOD',
  BAKERY: 'FOOD',
  CAFETERIA: 'FOOD',
  SUPERMARKET: 'FOOD',
  MARKET: 'FOOD',
  GROCERY: 'FOOD',
  HEALTH: 'HEALTH',
  CLINIC: 'HEALTH',
  SCHEDULING: 'HEALTH',
  BEAUTY: 'BEAUTY',
  PET: 'BEAUTY',
  GYM: 'BEAUTY',
  RECOVERY: 'RECOVERY',
  LEGAL: 'HOME_SERV',
  REALESTATE: 'HOME_SERV',
  AGENCY: 'HOME_SERV',
  AUTOMOTIVE: 'HOME_SERV',
  HOSPITALITY: 'HOME_SERV',
  SIMPLE_SERVICE: 'HOME_SERV',
  RENTAL: 'HOME_SERV',
  OTHER: 'HOME_SERV',
  EDUCATION: 'EDUCATION',
  B2B: 'B2B',
};

const CATEGORY_TO_STRATEGY: Record<NicheCategory, NicheStrategy> = {
  RETAIL: 'COMMERCE',
  ECOMMERCE: 'COMMERCE',
  FOOD: 'COMMERCE',
  HEALTH: 'SCHEDULING',
  BEAUTY: 'SCHEDULING',
  RECOVERY: 'RECOVERY',
  HOME_SERV: 'CONSULTATIVE',
  EDUCATION: 'CONSULTATIVE',
  B2B: 'CONSULTATIVE',
  DEFAULT: 'CONSULTATIVE',
};

const CATEGORY_DISPLAY_NAMES: Record<NicheCategory, string> = {
  RETAIL: 'Varejo',
  ECOMMERCE: 'E-commerce',
  FOOD: 'Food & Delivery',
  HEALTH: 'Saúde & Agenda',
  BEAUTY: 'Beleza & Estética',
  RECOVERY: 'Cobrança & Recovery',
  HOME_SERV: 'Serviços Profissionais',
  EDUCATION: 'Educação & Cursos',
  B2B: 'Empresas B2B',
  DEFAULT: 'Geral',
};

export class NicheClassifier {
  classify(businessType?: string | null): NicheClassification {
    if (!businessType) {
      return { category: 'DEFAULT', strategy: 'CONSULTATIVE' };
    }

    const normalized = businessType.trim().toUpperCase();
    if (!normalized) {
      return { category: 'DEFAULT', strategy: 'CONSULTATIVE' };
    }

    const category = BUSINESS_TYPE_TO_CATEGORY[normalized] ?? 'DEFAULT';
    const strategy = CATEGORY_TO_STRATEGY[category];

    return { category, strategy };
  }

  getDisplayName(category: NicheCategory): string {
    return CATEGORY_DISPLAY_NAMES[category];
  }
}
