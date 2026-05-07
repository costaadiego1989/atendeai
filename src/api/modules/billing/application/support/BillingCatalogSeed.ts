import { Prisma } from '@prisma/client';

export const BILLING_CATALOG_VERSION = '2026.04-niche-ops';

export const BILLING_PLAN_SEED = [
  {
    code: 'ESSENCIAL',
    displayName: 'Essencial',
    description: 'Entrada para validar WhatsApp, CRM e IA em uma operação pequena.',
    monthlyPrice: 297,
    messagesQuota: 1000,
    aiTokensQuota: 300000,
    contactsQuota: 1000,
    sortOrder: 1,
    features: [
      '1 tenant com matriz operacional',
      '1 filial ativa incluida',
      '1 numero de WhatsApp conectado',
      'Inbox, CRM e IA assistiva',
      'relatórios basicos de uso',
    ],
    config: {
      limits: {
        branches: 1,
        whatsappNumbers: 1,
        users: 3,
        prospectingDaily: 150,
      },
      modules: {
        INBOX: true,
        CRM: true,
        AI_ASSISTANT: true,
        BASIC_REPORTS: true,
      },
    },
  },
  {
    code: 'PROFISSIONAL',
    displayName: 'Profissional',
    description: 'Rotina diaria com mais capacidade, equipe e automacoes por nicho.',
    monthlyPrice: 597,
    messagesQuota: 5000,
    aiTokensQuota: 1500000,
    contactsQuota: 7500,
    sortOrder: 2,
    features: [
      'Até 3 filiais ativas incluidas',
      'Até 3 números de WhatsApp conectados',
      'IA com contexto comercial por nicho',
      'Automações operacionais',
      'Relatórios por periodo e filtros',
    ],
    config: {
      limits: {
        branches: 3,
        whatsappNumbers: 3,
        users: 10,
        prospectingDaily: 300,
      },
      modules: {
        INBOX: true,
        CRM: true,
        AI_ASSISTANT: true,
        BASIC_REPORTS: true,
        ADVANCED_FILTERS: true,
      },
    },
  },
  {
    code: 'ESCALA',
    displayName: 'Escala',
    description: 'Operacao multi-time com filiais, multiplos WhatsApps e governança.',
    monthlyPrice: 797,
    messagesQuota: 20000,
    aiTokensQuota: 6000000,
    contactsQuota: 30000,
    sortOrder: 3,
    features: [
      'Até 10 filiais ativas incluidas',
      'Até 10 números de WhatsApp conectados',
      'governança e roteamento multi-time',
      'Mais margem para integrações e picos',
      'Dashboards avancados por necessidade do negocio',
    ],
    config: {
      limits: {
        branches: 10,
        whatsappNumbers: 10,
        users: 30,
        prospectingDaily: 1000,
      },
      modules: {
        INBOX: true,
        CRM: true,
        AI_ASSISTANT: true,
        BASIC_REPORTS: true,
        ADVANCED_FILTERS: true,
        TEAM_ROUTING_BASE: true,
      },
    },
  },
] as const;

export const BILLING_MODULE_SEED = [
  {
    code: 'EXTRA_BRANCH',
    displayName: 'Filial adicional',
    description: 'Adiciona mais uma filial ativa acima do limite do plano base.',
    category: 'OPERATIONS',
    monthlyPrice: 149,
    salesPitch: 'Para expandir por unidade sem trocar todo o plano imediatamente.',
    config: {
      capacity: {
        branches: 1,
      },
    },
  },
  {
    code: 'EXTRA_WHATSAPP_NUMBER',
    displayName: 'WhatsApp adicional',
    description: 'Adiciona mais um numero de WhatsApp conectado para filial, equipe ou canal.',
    category: 'CHANNELS',
    monthlyPrice: 79,
    salesPitch: 'Ideal para separar matriz, filial, delivery, cobranca ou suporte.',
    config: {
      capacity: {
        whatsappNumbers: 1,
      },
    },
  },
  {
    code: 'EXTRA_USER',
    displayName: 'Usuario operacional adicional',
    description: 'Adiciona mais um usuario operacional acima do limite do plano base.',
    category: 'OPERATIONS',
    monthlyPrice: 39,
    salesPitch: 'Para crescer equipe sem mudar de plano antes da hora.',
    config: {
      capacity: {
        users: 1,
      },
    },
  },
  {
    code: 'TEAM_ROUTING',
    displayName: 'Roteamento de equipe',
    description: 'Distribuicao de conversas por fila, usuario, filial e regra operacional.',
    category: 'OPERATIONS',
    monthlyPrice: 129,
    salesPitch: 'Evita gargalo quando mais pessoas atendem no mesmo tenant.',
  },
  {
    code: 'ANALYTICS_PRO',
    displayName: 'relatórios avancados',
    description: 'Indicadores por periodo, modulo, filial, atendente e resultado.',
    category: 'ANALYTICS',
    monthlyPrice: 197,
    salesPitch: 'Transforma uso em decisao de gestao.',
  },
  {
    code: 'INTEGRATIONS_HUB',
    displayName: 'Hub de integrações',
    description: 'Conecta operações criticas com agenda, catalogo, pagamento e sistemas externos.',
    category: 'INTEGRATIONS',
    monthlyPrice: 297,
    salesPitch: 'Para negocios que precisam sincronizar dados e reduzir retrabalho.',
  },
  {
    code: 'CHECKOUT_CONVERSATIONAL',
    displayName: 'Checkout conversacional',
    description: 'Carrinho, pagamento, status do pedido e fluxo de compra pelo WhatsApp.',
    category: 'COMMERCE',
    monthlyPrice: 197,
    salesPitch: 'Transforma atendimento em pedido pago.',
  },
  {
    code: 'CATALOG_INVENTORY',
    displayName: 'Catalogo e estoque avancado',
    description: 'Produtos complexos, categorias, variacoes livres e snapshot de estoque.',
    category: 'COMMERCE',
    monthlyPrice: 147,
    salesPitch: 'Para vender com disponibilidade real e menos erro operacional.',
  },
  {
    code: 'ABANDONED_CART',
    displayName: 'Carrinho abandonado',
    description: 'Detecta abandono e cria toques de recuperacao de compra.',
    category: 'COMMERCE',
    monthlyPrice: 147,
    salesPitch: 'Recupera receita que ficaria parada na conversa.',
  },
  {
    code: 'COUPONS_PROMOTIONS',
    displayName: 'Cupons e promocoes',
    description: 'Cupons, campanhas e incentivos por conversa.',
    category: 'COMMERCE',
    monthlyPrice: 97,
    salesPitch: 'Ajuda a converter pedidos e medir campanhas.',
  },
  {
    code: 'DELIVERY_SHIPPING',
    displayName: 'Entrega e frete',
    description: 'Politica de entrega, retirada, taxa fixa ou por area.',
    category: 'COMMERCE',
    monthlyPrice: 97,
    salesPitch: 'Essencial para delivery, mercado, padaria e e-commerce local.',
  },
  {
    code: 'SCHEDULING_PRO',
    displayName: 'Agenda profissional',
    description: 'Categorias, profissionais, disponibilidade, reserva e reagendamento.',
    category: 'SCHEDULING',
    monthlyPrice: 197,
    salesPitch: 'Converte conversa em horario reservado.',
  },
  {
    code: 'GOOGLE_CALENDAR_MEET',
    displayName: 'Google Calendar e Meet',
    description: 'Sincronizacao com calendario e criacao de link online quando necessario.',
    category: 'SCHEDULING',
    monthlyPrice: 97,
    salesPitch: 'Reduz agenda duplicada e melhora experiencia em consultas online.',
  },
  {
    code: 'SCHEDULING_REMINDERS',
    displayName: 'Lembretes e confirmacoes',
    description: 'Confirmacao automatica, lembretes e reducao de faltas.',
    category: 'SCHEDULING',
    monthlyPrice: 97,
    salesPitch: 'Protege a agenda e reduz no-show.',
  },
  {
    code: 'PREPAID_BOOKING',
    displayName: 'Pagamento antecipado de agenda',
    description: 'Reserva com pagamento, expiracao e confirmacao automatica.',
    category: 'SCHEDULING',
    monthlyPrice: 97,
    salesPitch: 'Aumenta compromisso em servicos de alto valor.',
  },
  {
    code: 'RECOVERY_WALLET',
    displayName: 'Carteira de cobranca',
    description: 'Casos, valores, status, responsavel e historico de cobranca.',
    category: 'RECOVERY',
    monthlyPrice: 197,
    salesPitch: 'Organiza devedores e prioriza recuperacao.',
  },
  {
    code: 'RECOVERY_AUTOMATION',
    displayName: 'Regua de cobranca',
    description: 'Cadencias, promessas de pagamento, negociacao e follow-up.',
    category: 'RECOVERY',
    monthlyPrice: 147,
    salesPitch: 'Aumenta recuperacao com cadencia controlada.',
  },
  {
    code: 'RECOVERY_REPORTS',
    displayName: 'relatórios de recuperacao',
    description: 'Receita recuperada, carteira aberta, promessas e risco.',
    category: 'RECOVERY',
    monthlyPrice: 97,
    salesPitch: 'Mostra o impacto real da cobranca.',
  },
  {
    code: 'LEAD_QUALIFICATION',
    displayName: 'Qualificacao de leads',
    description: 'Playbooks para entender necessidade, urgencia, perfil e proximo passo.',
    category: 'SALES',
    monthlyPrice: 147,
    salesPitch: 'Ajuda servicos consultivos a vender com contexto.',
  },
  {
    code: 'PROPOSALS_QUOTES',
    displayName: 'Orcamentos e propostas',
    description: 'Coleta dados e organiza pedidos de orcamento ou proposta.',
    category: 'SALES',
    monthlyPrice: 97,
    salesPitch: 'Reduz retrabalho e acelera resposta comercial.',
  },
  {
    code: 'PROSPECTING_ENGINE',
    displayName: 'Motor de prospeccao',
    description: 'Busca, segmentacao e campanhas outbound controladas.',
    category: 'PROSPECTING',
    monthlyPrice: 197,
    salesPitch: 'Gera novas oportunidades para operações comerciais.',
  },
  {
    code: 'PAYMENT_LINKS',
    displayName: 'Links de pagamento',
    description: 'Gere links de pagamento rápidos para cartao, pix ou boleto diretamente na conversa.',
    category: 'PAYMENTS',
    monthlyPrice: 97,
    salesPitch: 'Agiliza a conversao e reduz a barreira de pagamento.',
  },
] as const;

export const BILLING_NICHE_SEED = [
  {
    code: 'RETAIL',
    displayName: 'Varejo',
    description: 'Lojas com catalogo, estoque, atendimento e recompra.',
    pains: ['responder rapido', 'mostrar disponibilidade', 'recuperar oportunidade'],
    modules: ['CATALOG_INVENTORY', 'CHECKOUT_CONVERSATIONAL', 'COUPONS_PROMOTIONS', 'TEAM_ROUTING', 'ABANDONED_CART', 'DELIVERY_SHIPPING', 'ANALYTICS_PRO'],
  },
  {
    code: 'ECOMMERCE',
    displayName: 'E-commerce',
    description: 'Venda online com carrinho, pagamento, entrega e abandono.',
    pains: ['converter carrinho', 'reduzir abandono', 'organizar pedidos'],
    modules: ['CATALOG_INVENTORY', 'CHECKOUT_CONVERSATIONAL', 'ABANDONED_CART', 'DELIVERY_SHIPPING', 'COUPONS_PROMOTIONS', 'ANALYTICS_PRO', 'TEAM_ROUTING'],
  },
  {
    code: 'FOOD',
    displayName: 'Food & Delivery',
    description: 'Alimentos, mercado, padaria e delivery com pico operacional.',
    pains: ['atender pico', 'montar pedido', 'controlar entrega'],
    modules: ['CATALOG_INVENTORY', 'CHECKOUT_CONVERSATIONAL', 'DELIVERY_SHIPPING', 'COUPONS_PROMOTIONS', 'ABANDONED_CART', 'ANALYTICS_PRO', 'TEAM_ROUTING'],
  },
  {
    code: 'HEALTH',
    displayName: 'Saude & Agenda',
    description: 'Clinicas e servicos agendados com confirmacao e relacionamento.',
    pains: ['preencher agenda', 'reduzir faltas', 'confirmar atendimento'],
    modules: ['SCHEDULING_PRO', 'SCHEDULING_REMINDERS', 'PREPAID_BOOKING', 'GOOGLE_CALENDAR_MEET', 'ANALYTICS_PRO'],
  },
  {
    code: 'BEAUTY',
    displayName: 'Beleza, Pet & Studios',
    description: 'Servicos recorrentes por horario, profissional e unidade.',
    pains: ['reduzir no-show', 'organizar profissionais', 'vender recorrência'],
    modules: ['SCHEDULING_PRO', 'SCHEDULING_REMINDERS', 'PREPAID_BOOKING', 'GOOGLE_CALENDAR_MEET', 'ANALYTICS_PRO', 'TEAM_ROUTING'],
  },
  {
    code: 'RECOVERY',
    displayName: 'Cobranca & Recovery',
    description: 'Carteira, cadencia, promessa de pagamento e receita recuperada.',
    pains: ['priorizar carteira', 'controlar promessas', 'medir recuperacao'],
    modules: ['RECOVERY_WALLET', 'RECOVERY_AUTOMATION', 'PAYMENT_LINKS', 'RECOVERY_REPORTS', 'TEAM_ROUTING', 'ANALYTICS_PRO'],
  },
  {
    code: 'HOME_SERV',
    displayName: 'Servicos consultivos',
    description: 'Qualificacao, orcamento, proposta e acompanhamento comercial.',
    pains: ['qualificar demanda', 'gerar orcamento', 'acompanhar retorno'],
    modules: ['LEAD_QUALIFICATION', 'PROPOSALS_QUOTES', 'PROSPECTING_ENGINE', 'TEAM_ROUTING', 'ANALYTICS_PRO'],
  },
  {
    code: 'B2B',
    displayName: 'Empresas B2B',
    description: 'Vendas complexas, propostas personalizadas e ciclo de venda longo.',
    pains: ['gerar propostas rapidas', 'acompanhar aprovacao', 'organizar pipeline b2b'],
    modules: ['PROPOSALS_QUOTES', 'LEAD_QUALIFICATION', 'PROSPECTING_ENGINE', 'TEAM_ROUTING', 'ANALYTICS_PRO'],
  },
] as const;

export function buildBillingCatalogSeedSql(): Prisma.Sql[] {
  const statements: Prisma.Sql[] = [];

  for (const plan of BILLING_PLAN_SEED) {
    statements.push(Prisma.sql`
      INSERT INTO billing_schema.billing_plan_catalog (
        code, display_name, description, monthly_price, messages_quota,
        ai_tokens_quota, contacts_quota, pricing_version, sort_order,
        active, features, is_standard, config
      ) VALUES (
        ${plan.code}, ${plan.displayName}, ${plan.description}, ${plan.monthlyPrice},
        ${plan.messagesQuota}, ${plan.aiTokensQuota}, ${plan.contactsQuota},
        ${BILLING_CATALOG_VERSION}, ${plan.sortOrder}, TRUE,
        ${JSON.stringify(plan.features)}::jsonb, TRUE, ${JSON.stringify(plan.config)}::jsonb
      )
      ON CONFLICT (code) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        monthly_price = EXCLUDED.monthly_price,
        messages_quota = EXCLUDED.messages_quota,
        ai_tokens_quota = EXCLUDED.ai_tokens_quota,
        contacts_quota = EXCLUDED.contacts_quota,
        pricing_version = EXCLUDED.pricing_version,
        sort_order = EXCLUDED.sort_order,
        active = TRUE,
        features = EXCLUDED.features,
        is_standard = TRUE,
        config = EXCLUDED.config,
        updated_at = now()
    `);
  }

  for (const module of BILLING_MODULE_SEED) {
    statements.push(Prisma.sql`
      INSERT INTO billing_schema.billing_modules (
        code, display_name, description, category, billing_mode,
        monthly_price, pricing_version, sales_pitch, quota_impact,
        included_in_plans, config, active
      ) VALUES (
        ${module.code}, ${module.displayName}, ${module.description},
        ${module.category}, 'ADDON', ${module.monthlyPrice},
        ${BILLING_CATALOG_VERSION}, ${module.salesPitch},
        '{}'::jsonb, '[]'::jsonb, ${JSON.stringify('config' in module ? module.config : {})}::jsonb, TRUE
      )
      ON CONFLICT (code) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        billing_mode = EXCLUDED.billing_mode,
        monthly_price = EXCLUDED.monthly_price,
        pricing_version = EXCLUDED.pricing_version,
        sales_pitch = EXCLUDED.sales_pitch,
        active = TRUE,
        updated_at = now()
    `);
  }

  for (const niche of BILLING_NICHE_SEED) {
    statements.push(Prisma.sql`
      INSERT INTO billing_schema.business_niches (
        code, display_name, description, pains, icon_name, active
      ) VALUES (
        ${niche.code}, ${niche.displayName}, ${niche.description},
        ${JSON.stringify(niche.pains)}::jsonb, NULL, TRUE
      )
      ON CONFLICT (code) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        pains = EXCLUDED.pains,
        active = TRUE,
        updated_at = now()
    `);

    niche.modules.forEach((moduleCode, index) => {
      statements.push(Prisma.sql`
        INSERT INTO billing_schema.niche_modules (
          niche_code, module_code, is_recommended, is_primary,
          marketing_headline, sales_pitch, sort_order
        ) VALUES (
          ${niche.code}, ${moduleCode}, TRUE, ${index < 3},
          NULL, NULL, ${index + 1}
        )
        ON CONFLICT (niche_code, module_code) DO UPDATE SET
          is_recommended = TRUE,
          is_primary = ${index < 3},
          sort_order = ${index + 1}
      `);
    });
  }

  return statements;
}
