export type BusinessType =
  | 'ecommerce'
  | 'clinic'
  | 'law'
  | 'restaurant'
  | 'recovery'
  | 'salon'
  | 'generic';

export interface PhaseDefinition {
  phases: readonly string[];
  transitions: Record<string, string[]>;
}

const UNIVERSAL_PHASES = ['GREETING', 'SUPPORT', 'COMPLAINT'] as const;
export type UniversalPhase = (typeof UNIVERSAL_PHASES)[number];

const NICHE_DEFINITIONS: Record<BusinessType, PhaseDefinition> = {
  ecommerce: {
    phases: [
      'GREETING',
      'QUALIFICATION',
      'PRODUCT_DISCOVERY',
      'QUOTE',
      'CHECKOUT',
      'CONFIRMATION',
      'SUPPORT',
      'COMPLAINT',
    ],
    transitions: {
      GREETING: ['QUALIFICATION', 'PRODUCT_DISCOVERY', 'SUPPORT', 'COMPLAINT'],
      QUALIFICATION: ['PRODUCT_DISCOVERY', 'QUOTE', 'SUPPORT', 'COMPLAINT'],
      PRODUCT_DISCOVERY: ['QUOTE', 'CHECKOUT', 'QUALIFICATION', 'COMPLAINT'],
      QUOTE: ['CHECKOUT', 'PRODUCT_DISCOVERY', 'QUALIFICATION', 'COMPLAINT'],
      CHECKOUT: ['CONFIRMATION', 'QUOTE', 'COMPLAINT'],
      CONFIRMATION: ['SUPPORT', 'GREETING'],
      SUPPORT: ['GREETING', 'COMPLAINT', 'QUALIFICATION'],
      COMPLAINT: ['SUPPORT', 'QUALIFICATION'],
    },
  },
  clinic: {
    phases: [
      'GREETING',
      'QUALIFICATION',
      'SCHEDULING',
      'CONFIRMATION',
      'FOLLOW_UP',
      'SUPPORT',
      'COMPLAINT',
    ],
    transitions: {
      GREETING: ['QUALIFICATION', 'SCHEDULING', 'SUPPORT', 'COMPLAINT'],
      QUALIFICATION: ['SCHEDULING', 'SUPPORT', 'COMPLAINT'],
      SCHEDULING: ['CONFIRMATION', 'QUALIFICATION', 'COMPLAINT'],
      CONFIRMATION: ['FOLLOW_UP', 'SUPPORT', 'GREETING'],
      FOLLOW_UP: ['SCHEDULING', 'SUPPORT', 'GREETING'],
      SUPPORT: ['GREETING', 'COMPLAINT', 'QUALIFICATION'],
      COMPLAINT: ['SUPPORT', 'QUALIFICATION'],
    },
  },
  law: {
    phases: [
      'GREETING',
      'QUALIFICATION',
      'CASE_ASSESSMENT',
      'PROPOSAL',
      'ONBOARDING',
      'SUPPORT',
      'COMPLAINT',
    ],
    transitions: {
      GREETING: ['QUALIFICATION', 'SUPPORT', 'COMPLAINT'],
      QUALIFICATION: ['CASE_ASSESSMENT', 'SUPPORT', 'COMPLAINT'],
      CASE_ASSESSMENT: ['PROPOSAL', 'QUALIFICATION', 'COMPLAINT'],
      PROPOSAL: ['ONBOARDING', 'CASE_ASSESSMENT', 'COMPLAINT'],
      ONBOARDING: ['SUPPORT', 'GREETING'],
      SUPPORT: ['GREETING', 'COMPLAINT', 'QUALIFICATION'],
      COMPLAINT: ['SUPPORT', 'QUALIFICATION'],
    },
  },
  restaurant: {
    phases: [
      'GREETING',
      'ORDER_TAKING',
      'CUSTOMIZATION',
      'CHECKOUT',
      'DELIVERY_TRACKING',
      'SUPPORT',
      'COMPLAINT',
    ],
    transitions: {
      GREETING: ['ORDER_TAKING', 'SUPPORT', 'COMPLAINT'],
      ORDER_TAKING: ['CUSTOMIZATION', 'CHECKOUT', 'COMPLAINT'],
      CUSTOMIZATION: ['CHECKOUT', 'ORDER_TAKING', 'COMPLAINT'],
      CHECKOUT: ['DELIVERY_TRACKING', 'ORDER_TAKING', 'COMPLAINT'],
      DELIVERY_TRACKING: ['SUPPORT', 'GREETING'],
      SUPPORT: ['GREETING', 'COMPLAINT', 'ORDER_TAKING'],
      COMPLAINT: ['SUPPORT', 'ORDER_TAKING'],
    },
  },
  recovery: {
    phases: [
      'GREETING',
      'DEBT_IDENTIFICATION',
      'NEGOTIATION',
      'PROMISE_TO_PAY',
      'FOLLOW_UP',
      'SUPPORT',
      'COMPLAINT',
    ],
    transitions: {
      GREETING: ['DEBT_IDENTIFICATION', 'SUPPORT', 'COMPLAINT'],
      DEBT_IDENTIFICATION: ['NEGOTIATION', 'SUPPORT', 'COMPLAINT'],
      NEGOTIATION: ['PROMISE_TO_PAY', 'DEBT_IDENTIFICATION', 'COMPLAINT'],
      PROMISE_TO_PAY: ['FOLLOW_UP', 'NEGOTIATION', 'COMPLAINT'],
      FOLLOW_UP: ['NEGOTIATION', 'SUPPORT', 'GREETING'],
      SUPPORT: ['GREETING', 'COMPLAINT', 'DEBT_IDENTIFICATION'],
      COMPLAINT: ['SUPPORT', 'DEBT_IDENTIFICATION'],
    },
  },
  salon: {
    phases: [
      'GREETING',
      'SERVICE_SELECTION',
      'PROFESSIONAL_SELECTION',
      'SCHEDULING',
      'CONFIRMATION',
      'SUPPORT',
      'COMPLAINT',
    ],
    transitions: {
      GREETING: ['SERVICE_SELECTION', 'SCHEDULING', 'SUPPORT', 'COMPLAINT'],
      SERVICE_SELECTION: ['PROFESSIONAL_SELECTION', 'SCHEDULING', 'COMPLAINT'],
      PROFESSIONAL_SELECTION: ['SCHEDULING', 'SERVICE_SELECTION', 'COMPLAINT'],
      SCHEDULING: ['CONFIRMATION', 'SERVICE_SELECTION', 'COMPLAINT'],
      CONFIRMATION: ['SUPPORT', 'GREETING'],
      SUPPORT: ['GREETING', 'COMPLAINT', 'SERVICE_SELECTION'],
      COMPLAINT: ['SUPPORT', 'SERVICE_SELECTION'],
    },
  },
  generic: {
    phases: [
      'GREETING',
      'QUALIFICATION',
      'PRODUCT_DISCOVERY',
      'QUOTE',
      'CHECKOUT',
      'CONFIRMATION',
      'SUPPORT',
      'COMPLAINT',
    ],
    transitions: {
      GREETING: ['QUALIFICATION', 'PRODUCT_DISCOVERY', 'SUPPORT', 'COMPLAINT'],
      QUALIFICATION: ['PRODUCT_DISCOVERY', 'QUOTE', 'SUPPORT', 'COMPLAINT'],
      PRODUCT_DISCOVERY: ['QUOTE', 'CHECKOUT', 'QUALIFICATION', 'COMPLAINT'],
      QUOTE: ['CHECKOUT', 'PRODUCT_DISCOVERY', 'QUALIFICATION', 'COMPLAINT'],
      CHECKOUT: ['CONFIRMATION', 'QUOTE', 'COMPLAINT'],
      CONFIRMATION: ['SUPPORT', 'GREETING'],
      SUPPORT: ['GREETING', 'COMPLAINT', 'QUALIFICATION'],
      COMPLAINT: ['SUPPORT', 'QUALIFICATION'],
    },
  },
};

export class PhaseDefinitionRegistry {
  private static readonly definitions = NICHE_DEFINITIONS;

  static getDefinition(businessType: BusinessType): PhaseDefinition {
    return this.definitions[businessType] ?? this.definitions.generic;
  }

  static getPhases(businessType: BusinessType): readonly string[] {
    return this.getDefinition(businessType).phases;
  }

  static getTransitions(businessType: BusinessType): Record<string, string[]> {
    return this.getDefinition(businessType).transitions;
  }

  static getSupportedBusinessTypes(): BusinessType[] {
    return Object.keys(this.definitions) as BusinessType[];
  }
}

export function isValidPhase(
  value: string,
  businessType: BusinessType = 'generic',
): boolean {
  const definition = PhaseDefinitionRegistry.getDefinition(businessType);
  return definition.phases.includes(value);
}

export function isValidTransition(
  from: string,
  to: string,
  businessType: BusinessType = 'generic',
): boolean {
  if (from === to) return true;
  const definition = PhaseDefinitionRegistry.getDefinition(businessType);
  if (!definition.phases.includes(from) || !definition.phases.includes(to)) {
    return false;
  }
  return definition.transitions[from]?.includes(to) ?? false;
}

export function getInitialPhase(): string {
  return 'GREETING';
}

export function isUniversalPhase(phase: string): boolean {
  return (UNIVERSAL_PHASES as readonly string[]).includes(phase);
}

// Backward compat — generic phases array (ecommerce default)
export const CONVERSATION_PHASES = NICHE_DEFINITIONS.generic.phases;
export type ConversationPhase = string;
