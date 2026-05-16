export type ConversationFlowStrategy =
  | 'COMMERCE'
  | 'SCHEDULING'
  | 'CONSULTATIVE'
  | 'RECOVERY';

export type ConversationFlowScenario = {
  key: string;
  title: string;
  turns: string[];
  expectedSignals: string[];
  expectation:
    | 'AI_RESPONSE'
    | 'COMMERCE_SESSION'
    | 'COMMERCE_CHECKOUT'
    | 'ABANDONMENT_TOUCH'
    | 'SCHEDULING_RESPONSE'
    | 'RECOVERY_NEGOTIATION';
};

export type ConversationFlowNiche = {
  businessType: string;
  label: string;
  strategy: ConversationFlowStrategy;
  description: string;
  services: string;
  scenarios: ConversationFlowScenario[];
};

const commerceScenarios: ConversationFlowScenario[] = [
  {
    key: 'price-stock',
    title: 'consulta preco e estoque',
    turns: ['cafe'],
    expectedSignals: ['cafe', 'bolo', 'preco', 'estoque', 'disponivel'],
    expectation: 'COMMERCE_SESSION',
  },
  {
    key: 'multi-product-checkout-delivery-coupon',
    title: 'carrinho com mais de um produto, cupom, entrega e pagamento',
    turns: [
      'cafe',
      '1',
      '2',
      'nao, finalizar',
      'entrega',
      'Rua das Flores 100, Copacabana',
      'sem observacao',
      'Tenho cupom {{couponCode}}',
      'pode mandar o link',
    ],
    expectedSignals: ['carrinho', 'entrega', 'cupom', 'pagamento', 'pix', 'link'],
    expectation: 'COMMERCE_CHECKOUT',
  },
  {
    key: 'abandoned-cart',
    title: 'carrinho abandonado antes do pagamento',
    turns: ['cafe', '1', '1'],
    expectedSignals: ['carrinho', 'entrega', 'pagamento', 'continuar'],
    expectation: 'ABANDONMENT_TOUCH',
  },
];

const schedulingScenarios: ConversationFlowScenario[] = [
  {
    key: 'service-discovery',
    title: 'descoberta de servico antes de agendar',
    turns: ['Tenho uma necessidade e quero saber qual servico voces recomendam'],
    expectedSignals: ['servico', 'recomendo', 'horario', 'agenda', 'avaliacao'],
    expectation: 'SCHEDULING_RESPONSE',
  },
  {
    key: 'book-appointment',
    title: 'pedido direto para marcar consulta ou servico',
    turns: [
      'Quero marcar uma avaliacao amanha',
      'Pode ser com a Dra Ana as 14h',
      'Confirmar esse horario por favor',
    ],
    expectedSignals: ['amanha', '14', 'confirmar', 'horario', 'agenda'],
    expectation: 'SCHEDULING_RESPONSE',
  },
  {
    key: 'reschedule-question',
    title: 'duvida de remarcacao e disponibilidade',
    turns: ['Ja tenho um horario, mas preciso remarcar para outro dia. Como fazemos?'],
    expectedSignals: ['remarcar', 'horario', 'disponibilidade', 'agenda'],
    expectation: 'SCHEDULING_RESPONSE',
  },
];

const consultativeScenarios: ConversationFlowScenario[] = [
  {
    key: 'lead-qualification',
    title: 'qualificacao do lead',
    turns: ['Preciso de ajuda, mas ainda nao sei exatamente qual servico contratar'],
    expectedSignals: ['entender', 'necessidade', 'servico', 'ajudar', 'recomendar'],
    expectation: 'AI_RESPONSE',
  },
  {
    key: 'proposal-request',
    title: 'pedido de proposta ou orcamento',
    turns: [
      'Quero um orcamento para resolver meu problema ainda essa semana',
      'Pode me explicar o proximo passo e valores?',
    ],
    expectedSignals: ['orcamento', 'valor', 'proximo passo', 'proposta'],
    expectation: 'AI_RESPONSE',
  },
  {
    key: 'handoff-sensitive',
    title: 'pedido sensivel que pode exigir humano',
    turns: ['Meu caso e urgente e preciso falar com uma pessoa responsavel agora'],
    expectedSignals: ['humano', 'responsavel', 'atendente', 'urgente', 'ajudar'],
    expectation: 'AI_RESPONSE',
  },
];

const recoveryScenarios: ConversationFlowScenario[] = [
  {
    key: 'overdue-explanation',
    title: 'cliente pede explicacao da cobranca',
    turns: ['Recebi uma cobranca e nao entendi o valor em aberto'],
    expectedSignals: ['cobranca', 'valor', 'em aberto', 'entender'],
    expectation: 'RECOVERY_NEGOTIATION',
  },
  {
    key: 'payment-promise',
    title: 'promessa de pagamento',
    turns: ['Consigo pagar na sexta, voces conseguem aguardar?'],
    expectedSignals: ['sexta', 'pagamento', 'combinado', 'promessa'],
    expectation: 'RECOVERY_NEGOTIATION',
  },
  {
    key: 'installment-negotiation',
    title: 'negociação de parcelamento',
    turns: ['Nao consigo pagar tudo hoje, tem como parcelar?'],
    expectedSignals: ['parcelar', 'negociar', 'opcao', 'pagamento'],
    expectation: 'RECOVERY_NEGOTIATION',
  },
];

export const conversationFlowNiches: ConversationFlowNiche[] = [
  {
    businessType: 'RETAIL',
    label: 'Varejo',
    strategy: 'COMMERCE',
    description: 'Loja com catalogo, estoque e retirada ou entrega.',
    services: 'Produtos, estoque, carrinho, cupom e pagamento por link.',
    scenarios: commerceScenarios,
  },
  {
    businessType: 'ECOMMERCE',
    label: 'E-commerce',
    strategy: 'COMMERCE',
    description: 'Venda online com checkout conversacional.',
    services: 'Catalogo, carrinho, cupom, frete, pagamento e abandono.',
    scenarios: commerceScenarios,
  },
  {
    businessType: 'FOOD',
    label: 'Restaurantes & Delivery',
    strategy: 'COMMERCE',
    description: 'Delivery com itens, complementos, entrega e pagamento.',
    services: 'Cardapio, pedido, entrega, cupom e pagamento.',
    scenarios: commerceScenarios,
  },
  {
    businessType: 'SUPERMARKET',
    label: 'Supermercado',
    strategy: 'COMMERCE',
    description: 'Compra assistida de itens de mercado.',
    services: 'Produtos do dia a dia, estoque, entrega, cupom e checkout.',
    scenarios: commerceScenarios,
  },
  {
    businessType: 'MARKET',
    label: 'Mercado',
    strategy: 'COMMERCE',
    description: 'Mercado de bairro com venda pelo WhatsApp.',
    services: 'Mercearia, bebidas, limpeza, entrega e retirada.',
    scenarios: commerceScenarios,
  },
  {
    businessType: 'GROCERY',
    label: 'Mercearia',
    strategy: 'COMMERCE',
    description: 'Catalogo enxuto com carrinho assistido.',
    services: 'Itens basicos, estoque, entrega e pagamento.',
    scenarios: commerceScenarios,
  },
  {
    businessType: 'BAKERY',
    label: 'Padaria',
    strategy: 'COMMERCE',
    description: 'Padaria com pedidos rapidos e retirada ou entrega.',
    services: 'Pao, bolo, cafe, entrega, retirada e pagamento.',
    scenarios: commerceScenarios,
  },
  {
    businessType: 'CAFETERIA',
    label: 'Cafeteria',
    strategy: 'COMMERCE',
    description: 'Venda de bebidas e acompanhamentos.',
    services: 'Cafe, bolo, combos, entrega e pagamento.',
    scenarios: commerceScenarios,
  },
  {
    businessType: 'HEALTH',
    label: 'Clinicas & Saude',
    strategy: 'SCHEDULING',
    description: 'Clinica com profissionais, categorias e agenda.',
    services: 'Avaliacao, consulta, clareamento e retornos.',
    scenarios: schedulingScenarios,
  },
  {
    businessType: 'BEAUTY',
    label: 'Beleza & Estetica',
    strategy: 'SCHEDULING',
    description: 'Atendimento por horario em beleza e estetica.',
    services: 'Corte, barba, limpeza de pele e procedimentos esteticos.',
    scenarios: schedulingScenarios,
  },
  {
    businessType: 'PET',
    label: 'Petshops & Vets',
    strategy: 'SCHEDULING',
    description: 'Petshop com servicos agendados e produtos.',
    services: 'Banho, tosa, vacina, racao e acessorios.',
    scenarios: schedulingScenarios,
  },
  {
    businessType: 'GYM',
    label: 'Academias & Studios',
    strategy: 'SCHEDULING',
    description: 'Studio com aulas e horarios.',
    services: 'Aula experimental, avaliacao fisica e planos.',
    scenarios: schedulingScenarios,
  },
  {
    businessType: 'SCHEDULING',
    label: 'Servico com agenda',
    strategy: 'SCHEDULING',
    description: 'Serviço profissional com agenda estruturada.',
    services: 'Consulta, atendimento, avaliação e remarcação.',
    scenarios: schedulingScenarios,
  },
  {
    businessType: 'CLINIC',
    label: 'Clinica',
    strategy: 'SCHEDULING',
    description: 'Clínica com agenda especializada.',
    services: 'Avaliação, consulta e procedimentos.',
    scenarios: schedulingScenarios,
  },
  {
    businessType: 'RECOVERY',
    label: 'Recovery',
    strategy: 'RECOVERY',
    description: 'Cobranca, negociação e recuperação de receita.',
    services: 'Cobrança, acordos, promessa de pagamento e parcelamento.',
    scenarios: recoveryScenarios,
  },
  ...[
    ['LEGAL', 'Advocacia & Consultores'],
    ['REALESTATE', 'Imobiliarias'],
    ['AGENCY', 'Agencias'],
    ['AUTOMOTIVE', 'Automotivo'],
    ['HOME_SERV', 'Servicos Residenciais'],
    ['HOSPITALITY', 'Hotelaria'],
    ['SIMPLE_SERVICE', 'Servico simples'],
    ['EDUCATION', 'Escolas & Cursos'],
    ['RENTAL', 'Locacao'],
    ['OTHER', 'Outro'],
  ].map(([businessType, label]) => ({
    businessType,
    label,
    strategy: 'CONSULTATIVE' as const,
    description: `${label} com atendimento consultivo por conversa.`,
    services: 'Qualificacao, proposta, proximos passos e atendimento humano.',
    scenarios: consultativeScenarios,
  })),
];
