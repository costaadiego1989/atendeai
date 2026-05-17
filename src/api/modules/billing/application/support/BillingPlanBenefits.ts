import { BillingPlanCatalogRecord } from '../../domain/repositories/IBillingRepository';

const ENTERPRISE_PLAN_BENEFITS: Record<string, string[]> = {
  ESSENCIAL: [
    '1 tenant com matriz operacional',
    '1 filial ativa incluida',
    '1 numero de WhatsApp conectado',
    'Inbox, CRM e IA assistiva para validar o canal',
    'relatórios basicos de uso e atendimento',
  ],
  PROFISSIONAL: [
    'Ate 3 filiais ativas incluidas',
    'Ate 3 numeros de WhatsApp conectados',
    'IA com contexto comercial por nicho',
    'Automacoes operacionais para vendas, agenda ou cobranca',
    'relatórios por periodo, filtros e rotina de equipe',
  ],
  ESCALA: [
    'Ate 10 filiais ativas incluidas',
    'Ate 10 numeros de WhatsApp conectados',
    'governança, roteamento e operacao multi-time',
    'Maior margem para integrações, picos e playbooks',
    'Dashboards avancados por necessidade do negocio',
  ],
};

export function applyEnterprisePlanBenefits(
  plan: BillingPlanCatalogRecord,
): BillingPlanCatalogRecord {
  const configuredFeatures = Array.isArray(plan.features) ? plan.features : [];
  const standardFeatures = ENTERPRISE_PLAN_BENEFITS[plan.code] ?? [];
  const features = Array.from(
    new Set([...standardFeatures, ...configuredFeatures]),
  );

  return {
    ...plan,
    features,
  };
}
