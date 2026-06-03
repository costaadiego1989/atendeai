import type {
  BillingAddonCatalogItem,
  BillingPlan,
  BillingSubscriptionCatalog,
  UsageData,
} from '@/shared/types';

export type BillingVolumeBand = 'LOW' | 'MEDIUM' | 'HIGH';
export type BillingOperationMode = 'LEAN' | 'AUTOMATED' | 'GOVERNED';
export type BillingAdvisorField =
  | 'conversationsBand'
  | 'contactsBand'
  | 'operationMode';

export interface BillingAdvisorAnswers {
  conversationsBand: BillingVolumeBand;
  contactsBand: BillingVolumeBand;
  operationMode: BillingOperationMode;
}

export interface BillingAdvisorOption<T extends string = string> {
  value: T;
  label: string;
  description: string;
  planHint: BillingPlan['code'];
}

export interface BillingAdvisorQuestion<T extends string = string> {
  field: BillingAdvisorField;
  label: string;
  helper: string;
  value: T;
  options: BillingAdvisorOption<T>[];
}

export interface BillingPlanRecommendation {
  recommendedPlan: BillingPlan | null;
  headline: string;
  summary: string;
  reasons: string[];
  primaryAddons: BillingAddonCatalogItem[];
  optionalAddons: BillingAddonCatalogItem[];
  estimatedAddonInvestment: number;
  quotaBenefits: string[];
  nicheBenefits: string[];
}

interface NichePlanProfile {
  summary: string;
  essentialBenefits: string[];
  professionalBenefits: string[];
  scaleBenefits: string[];
  primaryMetrics: string[];
}

const DEFAULT_NICHE_PROFILE: NichePlanProfile = {
  summary:
    'Combina conversas, CRM e IA para organizar seu atendimento e crescer com segurança.',
  essentialBenefits: [
    'Atendimento centralizado no WhatsApp com IA assistiva.',
    'CRM para organizar leads e clientes ativos.',
    'Ideal para começar e testar antes de adicionar módulos extras.',
  ],
  professionalBenefits: [
    'Mais conversas e tokens para automações do dia a dia.',
    'Espaço para vendas, atendimento e CRM no mesmo ciclo.',
    'Melhor encaixe para equipes com rotina comercial diária.',
  ],
  scaleBenefits: [
    'Capacidade alta para vários times simultâneos.',
    'Folga para integrações, roteamento e painéis de gestão.',
    'Estrutura para picos de demanda sem travar atendimento.',
  ],
  primaryMetrics: ['Conversas', 'Contatos', 'Tokens de IA'],
};

const NICHE_PROFILES: Record<string, NichePlanProfile> = {
  RETAIL: {
    summary:
      'Varejo precisa equilibrar atendimento rápido, catálogo, estoque e acompanhamento de vendas.',
    essentialBenefits: [
      'Começa com atendimento e catálogo sem complicação.',
      'Mantém contatos organizados para recompra e pós-venda.',
      'Suporta operação inicial com produtos e disponibilidade.',
    ],
    professionalBenefits: [
      'Mais fôlego para campanhas, carrinho e atendimento comercial.',
      'Combina CRM, catálogo e IA para aumentar conversão.',
      'Ideal quando a loja já recebe demanda diária pelo WhatsApp.',
    ],
    scaleBenefits: [
      'Capacidade para vários atendentes e volume intenso.',
      'Mais margem para integrações com estoque e operação física.',
      'Indicado para lojas com picos, campanhas e várias frentes.',
    ],
    primaryMetrics: ['Conversas de venda', 'Clientes na base', 'Tokens para ofertas'],
  },
  ECOMMERCE: {
    summary:
      'E-commerce depende de carrinho, pagamento, entrega e recuperação de abandono funcionando juntos.',
    essentialBenefits: [
      'Começa com checkout e dúvidas de produto.',
      'Atende a primeira carteira sem inflar custo fixo.',
      'Bom para testar demanda antes de automatizar.',
    ],
    professionalBenefits: [
      'Mais volume para carrinho, cupons, entrega e pós-compra.',
      'Faz sentido quando checkout e recuperação viram rotina.',
      'Dá fôlego para campanhas e atendimento simultâneo.',
    ],
    scaleBenefits: [
      'Suporta alto volume de pedidos e abandono de carrinho.',
      'Melhor para operação com catálogo grande e picos promocionais.',
      'Abre espaço para integrações e relatórios.',
    ],
    primaryMetrics: ['Pedidos por conversa', 'Carrinhos ativos', 'Recuperação'],
  },
  FOOD: {
    summary:
      'Alimentos e delivery precisam de velocidade, disponibilidade, adicionais, pagamento e entrega.',
    essentialBenefits: [
      'Começa com cardápio, pedidos simples e atendimento rápido.',
      'Boa entrada para testar horários de pico.',
      'Mantém a base de clientes pronta para recompra.',
    ],
    professionalBenefits: [
      'Mais capacidade para pedidos simultâneos e cupons.',
      'Acomoda complementos, entrega e recuperação de abandono.',
      'Indicado para delivery com demanda diária.',
    ],
    scaleBenefits: [
      'Preparado para picos de almoço, noite e campanhas.',
      'Suporta operação com cozinha, entrega e vários atendentes.',
      'Mais margem para integrações e relatórios de performance.',
    ],
    primaryMetrics: ['Pedidos', 'Clientes recorrentes', 'Abandono'],
  },
  HEALTH: {
    summary:
      'Saúde e clínicas combinam captação, triagem, agenda, confirmação e relacionamento.',
    essentialBenefits: [
      'Organiza leads e agendamento com IA assistiva.',
      'Bom para clínica testando agenda digital.',
      'Mantém contato e histórico de pacientes no início.',
    ],
    professionalBenefits: [
      'Mais capacidade para agenda, lembretes e recorrência.',
      'Indicado para vários profissionais ou alta procura.',
      'Melhor encaixe quando confirmações viram rotina.',
    ],
    scaleBenefits: [
      'Suporta clínicas com múltiplas agendas e controle.',
      'Mais tokens para triagem e orientações contextualizadas.',
      'Prepara a operação para integrações e indicadores.',
    ],
    primaryMetrics: ['Agendamentos', 'Pacientes', 'Confirmações'],
  },
  BEAUTY: {
    summary:
      'Beleza, pet e studios precisam preencher agenda, reduzir faltas e vender recorrência.',
    essentialBenefits: [
      'Boa entrada para organizar agenda e novos clientes.',
      'Permite testar confirmações e atendimento por horário.',
      'Ajuda a estruturar retorno e indicações.',
    ],
    professionalBenefits: [
      'Mais fôlego para múltiplos profissionais e lembretes.',
      'Ideal para rotina diária com agenda cheia.',
      'Ajuda a vender combos, pacotes e recorrência.',
    ],
    scaleBenefits: [
      'Suporta unidades, equipes e campanhas intensas.',
      'Mais margem para relatórios, roteamento e automações.',
      'Indicado para operação com alta recorrência.',
    ],
    primaryMetrics: ['Horários', 'Clientes recorrentes', 'No-show'],
  },
  RECOVERY: {
    summary:
      'Cobrança precisa priorizar carteira, promessas de pagamento, renegociação e controle de follow-up.',
    essentialBenefits: [
      'Começa com carteira pequena, mensagens e histórico.',
      'Boa entrada para organizar devedores e casos ativos.',
      'Permite testar abordagem antes de escalar automação.',
    ],
    professionalBenefits: [
      'Mais capacidade para ciclos de cobrança e follow-up.',
      'Indicado quando promessas e renegociações viram rotina.',
      'Acomoda maior base de contatos e cadências.',
    ],
    scaleBenefits: [
      'Suporta carteira grande e times de recuperação.',
      'Mais margem para controle, auditoria e painéis.',
      'Ideal para operação crítica de receita recuperada.',
    ],
    primaryMetrics: ['Casos ativos', 'Promessas', 'Follow-ups'],
  },
  HOME_SERV: {
    summary:
      'Serviços precisam qualificar demanda, gerar orçamento e organizar retorno comercial.',
    essentialBenefits: [
      'Boa entrada para capturar e qualificar leads.',
      'Mantém histórico e próximos passos sem complicação.',
      'Ajuda a entender demanda por tipo de serviço.',
    ],
    professionalBenefits: [
      'Mais capacidade para propostas e atendimento recorrente.',
      'Indicado quando há equipe ou agenda comercial diária.',
      'Melhor para acompanhar oportunidades até fechamento.',
    ],
    scaleBenefits: [
      'Suporta operação com vários especialistas ou unidades.',
      'Mais margem para roteamento, integrações e indicadores.',
      'Adequado para operações consultivas críticas.',
    ],
    primaryMetrics: ['Leads', 'Orçamentos', 'Retornos'],
  },
};

const BUSINESS_TYPE_TO_PROFILE: Record<string, string> = {
  RETAIL: 'RETAIL',
  ECOMMERCE: 'ECOMMERCE',
  SUPERMARKET: 'FOOD',
  MARKET: 'FOOD',
  GROCERY: 'FOOD',
  BAKERY: 'FOOD',
  CAFETERIA: 'FOOD',
  FOOD: 'FOOD',
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
  EDUCATION: 'HOME_SERV',
  AUTOMOTIVE: 'HOME_SERV',
  HOME_SERV: 'HOME_SERV',
  HOSPITALITY: 'HOME_SERV',
  SIMPLE_SERVICE: 'HOME_SERV',
  RENTAL: 'HOME_SERV',
  OTHER: 'HOME_SERV',
};

const PLAN_BENEFITS_BY_CODE: Record<BillingPlan['code'], keyof NichePlanProfile> = {
  ESSENCIAL: 'essentialBenefits',
  PROFISSIONAL: 'professionalBenefits',
  ESCALA: 'scaleBenefits',
};

export const CONVERSATION_BAND_OPTIONS: BillingAdvisorOption<BillingVolumeBand>[] = [
  {
    value: 'LOW',
    label: 'Começando',
    description: 'Poucos atendimentos por dia, time pequeno e operação concentrada.',
    planHint: 'ESSENCIAL',
  },
  {
    value: 'MEDIUM',
    label: 'Rotina comercial',
    description: 'Demanda diária, campanhas pontuais e uso frequente de IA.',
    planHint: 'PROFISSIONAL',
  },
  {
    value: 'HIGH',
    label: 'Alta demanda',
    description: 'Picos frequentes, vários atendentes ou automações em escala.',
    planHint: 'ESCALA',
  },
];

export const CONTACT_BAND_OPTIONS: BillingAdvisorOption<BillingVolumeBand>[] = [
  {
    value: 'LOW',
    label: 'Carteira inicial',
    description: 'Base pequena, ainda organizando os primeiros clientes.',
    planHint: 'ESSENCIAL',
  },
  {
    value: 'MEDIUM',
    label: 'CRM em crescimento',
    description: 'Leads e clientes já precisam de mais espaço por ciclo.',
    planHint: 'PROFISSIONAL',
  },
  {
    value: 'HIGH',
    label: 'Base grande',
    description: 'Muitos contatos, recorrência e operação com vários times.',
    planHint: 'ESCALA',
  },
];

export const OPERATION_MODE_OPTIONS: BillingAdvisorOption<BillingOperationMode>[] = [
  {
    value: 'LEAN',
    label: 'Simples',
    description: 'Time pequeno, módulos ativados aos poucos e baixo risco.',
    planHint: 'ESSENCIAL',
  },
  {
    value: 'AUTOMATED',
    label: 'Automatizada',
    description: 'IA, checkout, agenda ou cobrança já fazem parte do dia a dia.',
    planHint: 'PROFISSIONAL',
  },
  {
    value: 'GOVERNED',
    label: 'Estruturada',
    description: 'Precisa de controle, integrações e indicadores avançados.',
    planHint: 'ESCALA',
  },
];

function findPlan(plans: BillingPlan[], code: BillingPlan['code']) {
  return plans.find((plan) => plan.code === code) ?? null;
}

function resolveNicheProfile(
  subscriptionCatalog?: BillingSubscriptionCatalog | null,
): NichePlanProfile {
  const rawCode =
    subscriptionCatalog?.businessType ||
    subscriptionCatalog?.niche?.code ||
    'OTHER';
  const profileCode = BUSINESS_TYPE_TO_PROFILE[rawCode] ?? rawCode;

  return NICHE_PROFILES[profileCode] ?? DEFAULT_NICHE_PROFILE;
}

function getRequiredThreshold(
  plans: BillingPlan[],
  band: BillingVolumeBand,
  field: 'messagesQuota' | 'contactsQuota',
) {
  const essential = findPlan(plans, 'ESSENCIAL');
  const professional = findPlan(plans, 'PROFISSIONAL');
  const escala = findPlan(plans, 'ESCALA');

  if (band === 'HIGH') {
    return escala?.[field] ?? 0;
  }

  if (band === 'MEDIUM') {
    return professional?.[field] ?? 0;
  }

  return essential?.[field] ?? 0;
}

function formatQuota(value: number) {
  return value.toLocaleString('pt-BR');
}

function planQuotaBenefits(plan: BillingPlan | null, profile: NichePlanProfile) {
  if (!plan) {
    return [];
  }

  return [
    `${formatQuota(plan.messagesQuota)} conversas por ciclo para ${profile.primaryMetrics[0].toLowerCase()}.`,
    `${formatQuota(plan.contactsQuota)} contatos para ${profile.primaryMetrics[1].toLowerCase()}.`,
    `${formatQuota(plan.aiTokensQuota)} tokens de IA para ${profile.primaryMetrics[2].toLowerCase()}.`,
  ];
}

export function buildBillingAdvisorQuestions(
  answers: BillingAdvisorAnswers,
): BillingAdvisorQuestion[] {
  return [
    {
      field: 'conversationsBand',
      label: 'Volume de conversas',
      helper: 'Quantos atendimentos você espera por mês?',
      value: answers.conversationsBand,
      options: CONVERSATION_BAND_OPTIONS,
    },
    {
      field: 'contactsBand',
      label: 'Tamanho da base',
      helper: 'Quantos clientes, leads ou pacientes você tem hoje?',
      value: answers.contactsBand,
      options: CONTACT_BAND_OPTIONS,
    },
    {
      field: 'operationMode',
      label: 'Nível de automação',
      helper: 'Como funciona sua operação hoje?',
      value: answers.operationMode,
      options: OPERATION_MODE_OPTIONS,
    },
  ];
}

export function buildDefaultAdvisorAnswers(
  plans: BillingPlan[],
  usage?: UsageData | null,
  subscriptionCatalog?: BillingSubscriptionCatalog | null,
): BillingAdvisorAnswers {
  const primaryAddons =
    subscriptionCatalog?.availableAddons.filter((addon) => addon.primaryRecommendation) ?? [];
  const strategicAddons = new Set(primaryAddons.map((addon) => addon.code));

  const operationMode: BillingOperationMode = strategicAddons.has('INTEGRATIONS_HUB') ||
    strategicAddons.has('TEAM_ROUTING') ||
    strategicAddons.has('ANALYTICS_PRO')
    ? 'GOVERNED'
    : primaryAddons.length >= 2
      ? 'AUTOMATED'
      : 'LEAN';

  const professional = findPlan(plans, 'PROFISSIONAL');
  const essential = findPlan(plans, 'ESSENCIAL');

  const conversationsBand: BillingVolumeBand =
    !usage?.messages?.used
      ? primaryAddons.length >= 2
        ? 'MEDIUM'
        : 'LOW'
      : usage.messages.used > (professional?.messagesQuota ?? 0)
        ? 'HIGH'
        : usage.messages.used > ((essential?.messagesQuota ?? 0) * 0.6)
          ? 'MEDIUM'
          : 'LOW';

  const contactsBand: BillingVolumeBand =
    !usage?.contacts?.used
      ? operationMode === 'GOVERNED'
        ? 'MEDIUM'
        : 'LOW'
      : usage.contacts.used > (professional?.contactsQuota ?? 0)
        ? 'HIGH'
        : usage.contacts.used > ((essential?.contactsQuota ?? 0) * 0.6)
          ? 'MEDIUM'
          : 'LOW';

  return {
    conversationsBand,
    contactsBand,
    operationMode,
  };
}

export function buildBillingRecommendation(
  plans: BillingPlan[],
  subscriptionCatalog: BillingSubscriptionCatalog | null | undefined,
  answers: BillingAdvisorAnswers,
): BillingPlanRecommendation {
  const sortedPlans = [...plans]
    .filter((plan) => plan.code !== 'TRIAL')
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const primaryAddons =
    subscriptionCatalog?.availableAddons.filter((addon) => addon.primaryRecommendation) ?? [];
  const optionalAddons =
    subscriptionCatalog?.availableAddons.filter(
      (addon) => addon.recommended && !addon.primaryRecommendation,
    ) ?? [];

  const requiredMessages = getRequiredThreshold(
    sortedPlans,
    answers.conversationsBand,
    'messagesQuota',
  );
  const requiredContacts = getRequiredThreshold(
    sortedPlans,
    answers.contactsBand,
    'contactsQuota',
  );

  let recommendedPlan =
    sortedPlans.find(
      (plan) =>
        plan.messagesQuota >= requiredMessages &&
        plan.contactsQuota >= requiredContacts,
    ) ?? sortedPlans[sortedPlans.length - 1] ?? null;

  if (answers.operationMode === 'AUTOMATED' && recommendedPlan?.code === 'ESSENCIAL') {
    recommendedPlan = findPlan(sortedPlans, 'PROFISSIONAL') ?? recommendedPlan;
  }

  if (answers.operationMode === 'GOVERNED') {
    recommendedPlan = findPlan(sortedPlans, 'ESCALA') ?? recommendedPlan;
  }

  const nicheProfile = resolveNicheProfile(subscriptionCatalog);
  const reasons: string[] = [];

  if (answers.conversationsBand === 'HIGH') {
    reasons.push('O volume informado pede teto alto de conversas para evitar gargalo operacional.');
  } else if (answers.conversationsBand === 'MEDIUM') {
    reasons.push('A rotina comercial já pede folga acima da entrada inicial.');
  } else {
    reasons.push('O volume ainda cabe em uma validação controlada.');
  }

  if (answers.contactsBand === 'HIGH') {
    reasons.push('A base projetada pede capacidade robusta de CRM e histórico.');
  } else if (answers.contactsBand === 'MEDIUM') {
    reasons.push('A carteira já precisa de mais espaço para relacionamento e retorno.');
  } else {
    reasons.push('A base está adequada para organizar os primeiros relacionamentos.');
  }

  if (answers.operationMode === 'GOVERNED') {
    reasons.push('O modo escolhido pede governança, integrações e indicadores mais fortes.');
  } else if (answers.operationMode === 'AUTOMATED') {
    reasons.push('Automações já entram como rotina, então o plano precisa absorver IA e processos.');
  } else {
    reasons.push('Faz sentido iniciar enxuto e ativar módulos conforme a tração cresce.');
  }

  const nicheBenefits = recommendedPlan
    ? nicheProfile[PLAN_BENEFITS_BY_CODE[recommendedPlan.code]]
    : [];

  const estimatedAddonInvestment = [...primaryAddons, ...optionalAddons]
    .filter((addon) => addon.selectable)
    .reduce((sum, addon) => sum + addon.monthlyPrice, 0);

  return {
    recommendedPlan,
    headline: subscriptionCatalog?.niche
      ? `Para ${subscriptionCatalog.niche.displayName}, o plano base indicado é ${recommendedPlan?.displayName ?? 'o plano disponível'}.`
      : `O plano base indicado é ${recommendedPlan?.displayName ?? 'o plano disponível'}.`,
    summary: nicheProfile.summary,
    reasons,
    primaryAddons,
    optionalAddons,
    estimatedAddonInvestment,
    quotaBenefits: planQuotaBenefits(recommendedPlan, nicheProfile),
    nicheBenefits,
  };
}
