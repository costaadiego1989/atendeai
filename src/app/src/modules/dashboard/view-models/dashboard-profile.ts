import type { Tenant } from '@/shared/types';

export type DashboardProfileKey =
  | 'commerce'
  | 'scheduling'
  | 'service'
  | 'recovery'
  | 'default';

export type DashboardModuleCode =
  | 'CHECKOUT_WA'
  | 'ESTOQUE_IA'
  | 'FIDELIDADE_IA'
  | 'RECUPERACAO_LEADS'
  | 'AGENDAMENTO_ONLINE'
  | 'Cobrança_AUTO'
  | 'TRIAGEM_IA'
  | 'QUALIFICACAO_IA'
  | 'PROSPECCAO_ATIVA'
  | 'INTEGRATIONS_HUB'
  | 'TEAM_ROUTING'
  | 'IA_JURIDICA';

export interface DashboardModuleCard {
  code: DashboardModuleCode;
  label: string;
  description: string;
  route: string;
  icon: string;
  enabled: boolean;
  primary: boolean;
  recommended: boolean;
}

export interface DashboardProfile {
  key: DashboardProfileKey;
  businessType?: string;
  businessLabel: string;
  title: string;
  description: string;
  radarLabel: string;
  radarDescription: string;
  reportTitle: string;
  reportDescription: string;
  primaryAction: {
    label: string;
    route: string;
    icon: string;
  };
  secondaryActions: Array<{
    label: string;
    route: string;
    icon: string;
  }>;
  focusStats: Array<'handoff' | 'risk' | 'recovery' | 'paidRate' | 'contacts' | 'intents'>;
  moduleCards: DashboardModuleCard[];
}

const businessLabels: Record<string, string> = {
  AGENCY: 'Agências',
  AUTOMOTIVE: 'Automotivo',
  BEAUTY: 'Beleza & Estética',
  ECOMMERCE: 'E-commerce',
  EDUCATION: 'Escolas & Cursos',
  FOOD: 'Restaurantes & Delivery',
  GYM: 'Academias & Studios',
  HEALTH: 'Clínicas & Saúde',
  HOME_SERV: 'Serviços Residenciais',
  HOSPITALITY: 'Hotelaria',
  LEGAL: 'Advocacia & Consultores',
  PET: 'Petshops & Vets',
  REALESTATE: 'Imobiliárias',
  RETAIL: 'Varejo & Moda',
  MARKET: 'Mercado',
  GROCERY: 'Mercearia',
  BAKERY: 'Padaria',
  CAFETERIA: 'Cafeteria',
  SCHEDULING: 'Serviço com agenda',
  CLINIC: 'Clínica',
  RECOVERY: 'Recovery',
};

const nicheModules: Record<string, Array<{ code: DashboardModuleCode; primary?: boolean; recommended?: boolean }>> = {
  AGENCY: [
    { code: 'TRIAGEM_IA', primary: true },
    { code: 'QUALIFICACAO_IA' },
    { code: 'PROSPECCAO_ATIVA' },
    { code: 'TEAM_ROUTING', recommended: false },
  ],
  AUTOMOTIVE: [
    { code: 'AGENDAMENTO_ONLINE', primary: true },
    { code: 'PROSPECCAO_ATIVA' },
    { code: 'CHECKOUT_WA' },
    { code: 'RECUPERACAO_LEADS', recommended: false },
  ],
  BEAUTY: [
    { code: 'AGENDAMENTO_ONLINE', primary: true },
    { code: 'FIDELIDADE_IA' },
    { code: 'RECUPERACAO_LEADS' },
    { code: 'CHECKOUT_WA', recommended: false },
  ],
  ECOMMERCE: [
    { code: 'CHECKOUT_WA', primary: true },
    { code: 'ESTOQUE_IA' },
    { code: 'INTEGRATIONS_HUB' },
    { code: 'RECUPERACAO_LEADS', recommended: false },
  ],
  EDUCATION: [
    { code: 'TRIAGEM_IA', primary: true },
    { code: 'QUALIFICACAO_IA' },
    { code: 'Cobrança_AUTO' },
    { code: 'RECUPERACAO_LEADS', recommended: false },
  ],
  FOOD: [
    { code: 'CHECKOUT_WA', primary: true },
    { code: 'FIDELIDADE_IA' },
    { code: 'ESTOQUE_IA' },
    { code: 'RECUPERACAO_LEADS', recommended: false },
  ],
  GYM: [
    { code: 'AGENDAMENTO_ONLINE', primary: true },
    { code: 'Cobrança_AUTO' },
    { code: 'RECUPERACAO_LEADS' },
    { code: 'FIDELIDADE_IA', recommended: false },
  ],
  HEALTH: [
    { code: 'AGENDAMENTO_ONLINE', primary: true },
    { code: 'TRIAGEM_IA' },
    { code: 'FIDELIDADE_IA' },
    { code: 'Cobrança_AUTO', recommended: false },
  ],
  HOME_SERV: [
    { code: 'AGENDAMENTO_ONLINE', primary: true },
    { code: 'PROSPECCAO_ATIVA' },
    { code: 'CHECKOUT_WA', recommended: false },
    { code: 'Cobrança_AUTO', recommended: false },
  ],
  HOSPITALITY: [
    { code: 'AGENDAMENTO_ONLINE', primary: true },
    { code: 'TRIAGEM_IA' },
    { code: 'CHECKOUT_WA', recommended: false },
    { code: 'FIDELIDADE_IA', recommended: false },
  ],
  LEGAL: [
    { code: 'AGENDAMENTO_ONLINE', primary: true },
    { code: 'IA_JURIDICA' },
    { code: 'TRIAGEM_IA' },
    { code: 'Cobrança_AUTO', recommended: false },
  ],
  PET: [
    { code: 'AGENDAMENTO_ONLINE', primary: true },
    { code: 'FIDELIDADE_IA' },
    { code: 'Cobrança_AUTO', recommended: false },
    { code: 'CHECKOUT_WA', recommended: false },
  ],
  REALESTATE: [
    { code: 'TRIAGEM_IA', primary: true },
    { code: 'QUALIFICACAO_IA' },
    { code: 'AGENDAMENTO_ONLINE' },
    { code: 'PROSPECCAO_ATIVA', recommended: false },
  ],
  RETAIL: [
    { code: 'CHECKOUT_WA', primary: true },
    { code: 'ESTOQUE_IA' },
    { code: 'FIDELIDADE_IA' },
    { code: 'RECUPERACAO_LEADS', recommended: false },
  ],
};

const transactionalAliases = ['MARKET', 'GROCERY', 'BAKERY', 'CAFETERIA', 'SUPERMARKET'];
const schedulingAliases = ['SCHEDULING', 'CLINIC'];
const recoveryAliases = ['RECOVERY'];

const moduleDetails: Record<DashboardModuleCode, Omit<DashboardModuleCard, 'code' | 'enabled' | 'primary' | 'recommended'>> = {
  AGENDAMENTO_ONLINE: {
    label: 'Agenda online',
    description: 'Horários, reservas, profissionais e confirmações.',
    route: '/app/scheduling',
    icon: 'CalendarDays',
  },
  CHECKOUT_WA: {
    label: 'Checkout WhatsApp',
    description: 'Pedidos, links, pagamentos e abandono de carrinho.',
    route: '/app/checkout',
    icon: 'ShoppingCart',
  },
  Cobrança_AUTO: {
    label: 'Cobrança automática',
    description: 'Carteira em aberto, negociações e recorrências.',
    route: '/app/recovery',
    icon: 'Siren',
  },
  ESTOQUE_IA: {
    label: 'Estoque inteligente',
    description: 'Disponibilidade, ruptura e itens prontos para venda.',
    route: '/app/inventory',
    icon: 'Archive',
  },
  FIDELIDADE_IA: {
    label: 'Fidelidade IA',
    description: 'Promoções, recompra e relacionamento com clientes.',
    route: '/app/sales/promotions',
    icon: 'Sparkles',
  },
  IA_JURIDICA: {
    label: 'IA jurídica',
    description: 'Contexto e respostas para triagem consultiva.',
    route: '/app/settings/ai',
    icon: 'Bot',
  },
  INTEGRATIONS_HUB: {
    label: 'Integrações',
    description: 'Conectores para catálogo, estoque, canais e vendas.',
    route: '/app/settings/integrations',
    icon: 'Webhook',
  },
  PROSPECCAO_ATIVA: {
    label: 'Prospecção ativa',
    description: 'Busca, campanhas e captação assistida.',
    route: '/app/prospecting/searches',
    icon: 'Search',
  },
  QUALIFICACAO_IA: {
    label: 'Qualificação IA',
    description: 'Leads priorizados por interesse, etapa e potencial.',
    route: '/app/contacts',
    icon: 'Contact2',
  },
  RECUPERACAO_LEADS: {
    label: 'Recuperação de leads',
    description: 'Retomada de conversas e oportunidades paradas.',
    route: '/app/recovery',
    icon: 'RefreshCcw',
  },
  TEAM_ROUTING: {
    label: 'Roteamento do time',
    description: 'Distribuição de conversas e handoff operacional.',
    route: '/app/team',
    icon: 'UserPlus',
  },
  TRIAGEM_IA: {
    label: 'Triagem IA',
    description: 'Intenção, sentimento e necessidade antes do atendimento.',
    route: '/app/conversations',
    icon: 'MessageSquareText',
  },
};

const moduleAccessAliases: Record<DashboardModuleCode, string[]> = {
  AGENDAMENTO_ONLINE: [
    'AGENDAMENTO_ONLINE',
    'SCHEDULING_PRO',
    'GOOGLE_CALENDAR_MEET',
    'SCHEDULING_REMINDERS',
    'PREPAID_BOOKING',
  ],
  CHECKOUT_WA: [
    'CHECKOUT_WA',
    'CHECKOUT_CONVERSATIONAL',
    'ABANDONED_CART',
    'DELIVERY_SHIPPING',
    'COUPONS_PROMOTIONS',
  ],
  'Cobrança_AUTO': [
    'Cobrança_AUTO',
    'COBRANCA_AUTO',
    'RECOVERY_WALLET',
    'RECOVERY_AUTOMATION',
    'RECOVERY_REPORTS',
  ],
  ESTOQUE_IA: ['ESTOQUE_IA', 'CATALOG_INVENTORY'],
  FIDELIDADE_IA: ['FIDELIDADE_IA', 'COUPONS_PROMOTIONS'],
  IA_JURIDICA: ['IA_JURIDICA'],
  INTEGRATIONS_HUB: ['INTEGRATIONS_HUB'],
  PROSPECCAO_ATIVA: ['PROSPECCAO_ATIVA', 'PROSPECTING_ENGINE'],
  QUALIFICACAO_IA: ['QUALIFICACAO_IA', 'LEAD_QUALIFICATION', 'CRM'],
  RECUPERACAO_LEADS: ['RECUPERACAO_LEADS', 'ABANDONED_CART'],
  TEAM_ROUTING: ['TEAM_ROUTING', 'TEAM_ROUTING_BASE'],
  TRIAGEM_IA: ['TRIAGEM_IA', 'INBOX', 'AI_ASSISTANT'],
};

function normalizeBusinessType(value?: string | null) {
  return value?.trim().toUpperCase() || undefined;
}

function resolveNicheCode(businessType?: string) {
  if (!businessType) return undefined;
  if (transactionalAliases.includes(businessType)) return 'FOOD';
  if (schedulingAliases.includes(businessType)) return 'HEALTH';
  if (recoveryAliases.includes(businessType)) return 'GYM';
  return nicheModules[businessType] ? businessType : undefined;
}

function resolveProfileKey(businessType?: string, moduleCodes: string[] = []): DashboardProfileKey {
  const modules = new Set(moduleCodes);

  if (businessType && ['FOOD', 'RETAIL', 'ECOMMERCE', ...transactionalAliases].includes(businessType)) {
    return 'commerce';
  }
  if (businessType && ['HEALTH', 'BEAUTY', 'GYM', 'PET', 'HOME_SERV', 'HOSPITALITY', 'LEGAL', ...schedulingAliases].includes(businessType)) {
    return 'scheduling';
  }
  if (businessType && recoveryAliases.includes(businessType)) {
    return 'recovery';
  }
  if (modules.has('CHECKOUT_WA') || modules.has('ESTOQUE_IA')) {
    return 'commerce';
  }
  if (modules.has('AGENDAMENTO_ONLINE')) {
    return 'scheduling';
  }
  if (modules.has('Cobrança_AUTO') || modules.has('RECUPERACAO_LEADS')) {
    return 'recovery';
  }
  if (modules.has('TRIAGEM_IA') || modules.has('QUALIFICACAO_IA') || modules.has('PROSPECCAO_ATIVA')) {
    return 'service';
  }

  return 'default';
}

function hasModuleAccess(
  moduleAccess: Record<string, boolean> | undefined,
  code: DashboardModuleCode,
) {
  const normalizedAccess = new Map(
    Object.entries(moduleAccess ?? {}).map(([moduleCode, enabled]) => [
      moduleCode.trim().toUpperCase(),
      enabled,
    ]),
  );

  return moduleAccessAliases[code].some(
    (alias) => normalizedAccess.get(alias.trim().toUpperCase()) === true,
  );
}

function profileCopy(key: DashboardProfileKey) {
  switch (key) {
    case 'commerce':
      return {
        title: 'Painel de vendas conversacionais',
        description: 'Acompanhe pedidos, checkout, estoque e receita para agir rápido na operação.',
        radarLabel: 'Radar comercial',
        radarDescription: 'Priorize carrinhos, pagamentos, conversas com intenção de compra e itens que travam a venda.',
        reportTitle: 'Onde vender melhor agora',
        reportDescription: 'Resumo prático de pedidos, handoff, oportunidades e carteira aberta.',
        primaryAction: { label: 'Ver checkout', route: '/app/checkout', icon: 'ShoppingCart' },
        secondaryActions: [
          { label: 'Catálogo', route: '/app/catalog', icon: 'BookOpen' },
          { label: 'Estoque', route: '/app/inventory', icon: 'Archive' },
          { label: 'Links', route: '/app/sales/payment-links', icon: 'Wallet' },
        ],
        focusStats: ['paidRate', 'intents', 'handoff', 'risk'] as DashboardProfile['focusStats'],
      };
    case 'scheduling':
      return {
        title: 'Painel de agenda e atendimento',
        description: 'Monitore reservas, conversas que pedem resposta, confirmações e receita por atendimento.',
        radarLabel: 'Radar da agenda',
        radarDescription: 'Veja gargalos de atendimento, oportunidades de marcação e clientes que precisam de confirmação.',
        reportTitle: 'Onde proteger a agenda',
        reportDescription: 'Resumo de conversas, risco, cobrança e oportunidades ligadas aos atendimentos.',
        primaryAction: { label: 'Abrir agenda', route: '/app/scheduling', icon: 'CalendarDays' },
        secondaryActions: [
          { label: 'Inbox', route: '/app/conversations', icon: 'MessageSquareText' },
          { label: 'Contatos', route: '/app/contacts', icon: 'Contact2' },
          { label: 'Cobrança', route: '/app/recovery', icon: 'Siren' },
        ],
        focusStats: ['handoff', 'risk', 'contacts', 'recovery'] as DashboardProfile['focusStats'],
      };
    case 'recovery':
      return {
        title: 'Painel de cobrança e recuperação',
        description: 'Acompanhe carteira em aberto, promessas de pagamento, handoff e receita recuperada.',
        radarLabel: 'Radar financeiro',
        radarDescription: 'Priorize devedores, próximas ações e conversas que precisam de humano para recuperar receita.',
        reportTitle: 'Onde recuperar receita agora',
        reportDescription: 'Resumo prático de carteira, risco, pagamentos e conversas sensíveis.',
        primaryAction: { label: 'Abrir cobrança', route: '/app/recovery', icon: 'Siren' },
        secondaryActions: [
          { label: 'Links', route: '/app/sales/payment-links', icon: 'Wallet' },
          { label: 'Contatos', route: '/app/contacts', icon: 'Contact2' },
          { label: 'Inbox', route: '/app/conversations', icon: 'MessageSquareText' },
        ],
        focusStats: ['recovery', 'paidRate', 'handoff', 'risk'] as DashboardProfile['focusStats'],
      };
    case 'service':
      return {
        title: 'Painel comercial consultivo',
        description: 'Entenda leads, conversas qualificadas, prospecção e oportunidades em andamento.',
        radarLabel: 'Radar de oportunidades',
        radarDescription: 'Olhe primeiro para leads quentes, sentimentos negativos e conversas que precisam de especialista.',
        reportTitle: 'Onde qualificar melhor',
        reportDescription: 'Resumo de triagem, pipeline, handoff e oportunidades abertas.',
        primaryAction: { label: 'Abrir contatos', route: '/app/contacts', icon: 'Contact2' },
        secondaryActions: [
          { label: 'Inbox', route: '/app/conversations', icon: 'MessageSquareText' },
          { label: 'Prospectar', route: '/app/prospecting/searches', icon: 'Search' },
          { label: 'IA Comercial', route: '/app/settings/ai', icon: 'Bot' },
        ],
        focusStats: ['intents', 'contacts', 'handoff', 'risk'] as DashboardProfile['focusStats'],
      };
    default:
      return {
        title: 'Painel executivo',
        description: 'Leitura consolidada de conversas, CRM, cobrança, checkout e uso do plano.',
        radarLabel: 'Radar da operação',
        radarDescription: 'Use este painel para decidir onde atacar primeiro: conversas, CRM, cobrança e receita.',
        reportTitle: 'Onde o time deve olhar agora',
        reportDescription: 'Resumo prático de conversas, handoff, checkout e carteira em aberto.',
        primaryAction: { label: 'Abrir inbox', route: '/app/conversations', icon: 'MessageSquareText' },
        secondaryActions: [
          { label: 'Cobrança', route: '/app/recovery', icon: 'Siren' },
          { label: 'Checkouts', route: '/app/sales/payment-links', icon: 'Wallet' },
          { label: 'Contatos', route: '/app/contacts', icon: 'Contact2' },
        ],
        focusStats: ['handoff', 'risk', 'recovery', 'paidRate'] as DashboardProfile['focusStats'],
      };
  }
}

export function resolveDashboardProfile(tenant?: Tenant | null): DashboardProfile {
  const businessType = normalizeBusinessType(tenant?.businessType);
  const nicheCode = resolveNicheCode(businessType);
  const recommended = nicheCode ? nicheModules[nicheCode] ?? [] : [];
  const enabledModuleSet = new Set(tenant?.billingAccess?.enabledModules ?? []);
  const hasExplicitAccess = enabledModuleSet.size > 0;
  const profileKey = resolveProfileKey(businessType, [
    ...enabledModuleSet,
    ...recommended.map((item) => item.code),
  ]);
  const copy = profileCopy(profileKey);

  const moduleCards = recommended.map((item) => {
    const details = moduleDetails[item.code];
    return {
      code: item.code,
      ...details,
      enabled: hasExplicitAccess
        ? hasModuleAccess(tenant?.billingAccess?.moduleAccess, item.code)
        : true,
      primary: Boolean(item.primary),
      recommended: item.recommended !== false,
    };
  });

  return {
    key: profileKey,
    businessType,
    businessLabel: businessType ? businessLabels[businessType] ?? businessType : 'Nao definido',
    ...copy,
    moduleCards,
  };
}
