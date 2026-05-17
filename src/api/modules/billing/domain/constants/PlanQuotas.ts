import { PlanType } from '../value-objects/Quotas';

export interface PlanQuotaDefinition {
  messages: number;
  aiTokens: number;
  contacts: number;
}

const DEFAULT_PLAN_QUOTAS: Record<PlanType, PlanQuotaDefinition> = {
  TRIAL: {
    // Regra de negócio: garantir ao menos 30 mensagens automáticas/contato.
    // TRIAL: pequeno o suficiente para conversão, mas "usável" de verdade.
    contacts: 50,
    messages: 1500, // 50 * 30
    aiTokens: 150000, // 50 * 30 * 100 (tokens "billable" mínimos por msg)
  },
  ESSENCIAL: {
    // Exemplo citado: 500 contatos → mínimo 30 mensagens/contato.
    contacts: 500,
    messages: 15000, // 500 * 30
    aiTokens: 1500000, // 500 * 30 * 100
  },
  PROFISSIONAL: {
    contacts: 2500,
    messages: 75000, // 2500 * 30
    aiTokens: 7500000, // 2500 * 30 * 100
  },
  ESCALA: {
    contacts: 10000,
    messages: 300000, // 10000 * 30
    aiTokens: 30000000, // 10000 * 30 * 100
  },
};

function readPositiveIntegerEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  const parsed = Number(raw);

  if (!raw || !Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function getPlanQuotas(plan: PlanType): PlanQuotaDefinition {
  const fallback = DEFAULT_PLAN_QUOTAS[plan];

  return {
    messages: readPositiveIntegerEnv(
      `PLAN_MESSAGES_QUOTA_${plan}`,
      fallback.messages,
    ),
    aiTokens: readPositiveIntegerEnv(
      `PLAN_AI_TOKENS_QUOTA_${plan}`,
      fallback.aiTokens,
    ),
    contacts: readPositiveIntegerEnv(
      `PLAN_CONTACTS_QUOTA_${plan}`,
      fallback.contacts,
    ),
  };
}

export const PLAN_QUOTAS: Record<PlanType, PlanQuotaDefinition> = {
  TRIAL: getPlanQuotas('TRIAL'),
  ESSENCIAL: getPlanQuotas('ESSENCIAL'),
  PROFISSIONAL: getPlanQuotas('PROFISSIONAL'),
  ESCALA: getPlanQuotas('ESCALA'),
};
