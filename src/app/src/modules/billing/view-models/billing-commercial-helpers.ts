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
      'Varejo precisa equilibrar atendimento rapido, catalogo, estoque e follow-up de oportunidade.',
    essentialBenefits: [
      'Valida atendimento e catalogo com baixo risco.',
      'Mantem contatos organizados para recompra e pos-venda.',
      'Suporta operacao inicial com produtos e disponibilidade.',
    ],
    professionalBenefits: [
      'Mais folego para campanhas, carrinho e atendimento comercial.',
      'Combina CRM, catalogo e IA para aumentar conversao.',
      'Ideal quando a loja ja recebe demanda diaria pelo WhatsApp.',
    ],
    scaleBenefits: [
      'Capacidade para multiatendentes e volume intenso.',
      'Mais margem para integrações com estoque e operacao fisica.',
      'Indicado para lojas com picos, campanhas e varias frentes.',
    ],
    primaryMetrics: ['Conversas de venda', 'Clientes na base', 'Tokens para ofertas'],
  },
  ECOMMERCE: {
    summary:
      'E-commerce depende de carrinho, pagamento, entrega e recuperacao de abandono funcionando juntos.',
    essentialBenefits: [
      'Valida checkout conversacional e duvidas de produto.',
      'Atende a primeira carteira sem inflar custo fixo.',
      'Bom para provar demanda antes de automatizar abandono.',
    ],
    professionalBenefits: [
      'Mais volume para carrinho, cupons, entrega e pos-compra.',
      'Faz sentido quando checkout e recuperacao viram rotina.',
      'Da folego para campanhas e atendimento simultaneo.',
    ],
    scaleBenefits: [
      'Suporta alto volume de pedidos e abandono de carrinho.',
      'Melhor para operacao com catalogo grande e picos promocionais.',
      'Abre espaco para governança, integrações e relatórios.',
    ],
    primaryMetrics: ['Pedidos por conversa', 'Carrinhos ativos', 'Recuperacao'],
  },
  FOOD: {
    summary:
      'Alimentos e delivery precisam de velocidade, disponibilidade, adicionais, pagamento e entrega.',
    essentialBenefits: [
      'Começa com cardápio, pedidos simples e atendimento rapido.',
      'Boa entrada para validar horarios de pico.',
      'Mantem a base de clientes pronta para recompra.',
    ],
    professionalBenefits: [
      'Mais capacidade para pedidos simultaneos e cupons.',
      'Acomoda complementos, entrega e follow-up de abandono.',
      'Indicado para delivery com demanda diaria.',
    ],
    scaleBenefits: [
      'Preparado para picos de almoco, noite e campanhas.',
      'Suporta operacao com cozinha, entrega e varios atendentes.',
      'Mais margem para integrações e relatórios de performance.',
    ],
    primaryMetrics: ['Pedidos', 'Clientes recorrentes', 'Abandono'],
  },
  HEALTH: {
    summary:
      'Saude e clinicas combinam captacao, triagem, agenda, confirmacao e relacionamento.',
    essentialBenefits: [
      'Organiza leads e solicita agendamento com IA assistiva.',
      'Bom para clinica validando agenda digital.',
      'Mantem contato e historico de pacientes em volume inicial.',
    ],
    professionalBenefits: [
      'Mais capacidade para agenda, lembretes e recorrência.',
      'Indicado para varios profissionais ou alta procura.',
      'Melhor encaixe quando confirmacoes viram rotina operacional.',
    ],
    scaleBenefits: [
      'Suporta clinicas com multiagenda e governança.',
      'Mais tokens para triagem e orientacoes contextualizadas.',
      'Prepara a operacao para integrações e indicadores.',
    ],
    primaryMetrics: ['Agendamentos', 'Pacientes', 'Confirmacoes'],
  },
  BEAUTY: {
    summary:
      'Beleza, pet e studios precisam preencher agenda, reduzir faltas e vender recorrência.',
    essentialBenefits: [
      'Entrada boa para organizar agenda e novos clientes.',
      'Permite validar confirmacoes e atendimento por horario.',
      'Ajuda a estruturar retorno e indicacoes.',
    ],
    professionalBenefits: [
      'Mais folego para múltiplos profissionais e lembretes.',
      'Ideal para rotina diária com agenda cheia.',
      'Ajuda a vender combos, pacotes e recorrência.',
    ],
    scaleBenefits: [
      'Suporta unidades, equipes e campanhas intensas.',
      'Mais margem para relatórios, roteamento e automacoes.',
      'Indicado para operação com alta recorrência.',
    ],
    primaryMetrics: ['Horarios', 'Clientes recorrentes', 'No-show'],
  },
  RECOVERY: {
    summary:
      'Cobranca precisa priorizar carteira, promessas de pagamento, renegociação e controle de follow-up.',
    essentialBenefits: [
      'Valida carteira pequena com mensagens e histórico.',
      'Boa entrada para organizar devedores e casos ativos.',
      'Permite testar abordagem antes de escalar atomação.',
    ],
    professionalBenefits: [
      'Mais capacidade para ciclos de cobrança e follow-up.',
      'Indicado quando promessas e renegociações viram rotina.',
      'Acomoda maior base de contatos e cadências.',
    ],
    scaleBenefits: [
      'Suporta carteira grande e times de recuperacao.',
      'Mais margem para governança, auditoria e dashboards.',
      'Ideal para operação crítica de receita recuperada.',
    ],
    primaryMetrics: ['Casos ativos', 'Promessas', 'Follow-ups'],
  },
  HOME_SERV: {
    summary:
      'Servicos consultivos precisam qualificar demanda, gerar orcamento e organizar retorno comercial.',
    essentialBenefits: [
      'Boa entrada para capturar e qualificar leads.',
      'Mantem historico e proximos passos sem complexidade.',
      'Ajuda a validar demanda por tipo de servico.',
    ],
    professionalBenefits: [
      'Mais capacidade para propostas e atendimento recorrente.',
      'Indicado quando ha equipe ou agenda comercial diaria.',
      'Melhor para acompanhar oportunidades ate fechamento.',
    ],
    scaleBenefits: [
      'Suporta operacao com varios especialistas ou unidades.',
      'Mais margem para roteamento, integrações e indicadores.',
      'Adequado para operações consultivas criticas.',
    ],
    primaryMetrics: ['Leads', 'Orcamentos', 'Retornos'],
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
    label: 'Essencial para iniciar',
    description: 'Time pequeno, modulos ativados aos poucos e baixo risco operacional.',
    planHint: 'ESSENCIAL',
  },
  {
    value: 'AUTOMATED',
    label: 'Automação como rotina',
    description: 'IA, checkout, agenda ou cobrança ja fazem parte do processo diario.',
    planHint: 'PROFISSIONAL',
  },
  {
    value: 'GOVERNED',
    label: 'governança e escala',
    description: 'Precisa de controle, integrações, indicadores e operacao mais critica.',
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
      helper: 'Escolha o ritmo esperado de atendimento, vendas ou cobrança no ciclo.',
      value: answers.conversationsBand,
      options: CONVERSATION_BAND_OPTIONS,
    },
    {
      field: 'contactsBand',
      label: 'Tamanho da base',
      helper: 'Considere leads, clientes, pacientes, devedores ou recorrentes ativos.',
      value: answers.contactsBand,
      options: CONTACT_BAND_OPTIONS,
    },
    {
      field: 'operationMode',
      label: 'Maturidade operacional',
      helper: 'Defina se o negócio esta validando, automatizando ou governando escala.',
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
  const sortedPlans = [...plans].sort((left, right) => left.sortOrder - right.sortOrder);
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
    reasons.push('A rotina comercial ja pede folga acima da entrada inicial.');
  } else {
    reasons.push('O volume ainda cabe em uma validação controlada.');
  }

  if (answers.contactsBand === 'HIGH') {
    reasons.push('A base projetada pede capacidade robusta de CRM e histórico.');
  } else if (answers.contactsBand === 'MEDIUM') {
    reasons.push('A carteira já precisa de mais espaco para relacionamento e retorno.');
  } else {
    reasons.push('A base está adequada para organizar os primeiros relacionamentos.');
  }

  if (answers.operationMode === 'GOVERNED') {
    reasons.push('O modo escolhido pede governança, integrações e indicadores mais fortes.');
  } else if (answers.operationMode === 'AUTOMATED') {
    reasons.push('Automacoes ja entram como rotina, entao o plano precisa absorver IA e processos.');
  } else {
    reasons.push('Faz sentido iniciar enxuto e ativar modulos conforme a tração cresce.');
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
      ? `Para ${subscriptionCatalog.niche.displayName}, o plano base indicado e ${recommendedPlan?.displayName ?? 'o plano disponivel'}.`
      : `O plano base indicado e ${recommendedPlan?.displayName ?? 'o plano disponível'}.`,
    summary: nicheProfile.summary,
    reasons,
    primaryAddons,
    optionalAddons,
    estimatedAddonInvestment,
    quotaBenefits: planQuotaBenefits(recommendedPlan, nicheProfile),
    nicheBenefits,
  };
}
