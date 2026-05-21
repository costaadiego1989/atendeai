/** Limite do `UpsertTenantAgentRuleDto.customPrompt` na API (class-validator). */
export const AGENT_RULE_PROMPT_MAX_LENGTH = 500;

/** Limite do campo `notes` no DTO da API. */
export const AGENT_RULE_NOTES_MAX_LENGTH = 500;

/** Paridade com `AgentModule` no backend Nest. */
export const AGENT_RULE_MODULE_IDS = [
  'messaging',
  'prospecting',
  'checkout',
  'scheduling',
  'sales',
  'recovery',
  'channels',
  'alerts',
  'team',
  'billing',
  'widget',
] as const;

export type AgentRuleModuleId = (typeof AGENT_RULE_MODULE_IDS)[number];

export type AgentRuleModuleConfig = {
  moduleId: AgentRuleModuleId;
  moduleLabel: string;
  moduleDescription: string;
  placeholder: string;
  trainingExamples?: Array<{
    title: string;
    prompt: string;
  }>;
};

export const AGENT_MODULES_CONFIG: Record<AgentRuleModuleId, AgentRuleModuleConfig> = {
  messaging: {
    moduleId: 'messaging',
    moduleLabel: 'Conversas & Chat',
    moduleDescription: 'Define como a IA responde nas conversas diretas de WhatsApp/Instagram.',
    placeholder:
      'Ex: Seja sempre amigavel, não de respostas longas. Se o cliente perguntar de preços, direcione para o catalogo.',
    trainingExamples: [
      {
        title: 'Atendimento objetivo',
        prompt:
          'Responda em mensagens curtas, confirme o entendimento do cliente e termine com apenas uma pergunta clara para avancar o atendimento.',
      },
      {
        title: 'Handoff humano',
        prompt:
          'Se houver reclamação, urgencia, cancelamento ou duvida sensivel, resuma o contexto e solicite atendimento humano sem prometer o que não foi validado.',
      },
    ],
  },
  prospecting: {
    moduleId: 'prospecting',
    moduleLabel: 'Prospecção (SDR)',
    moduleDescription: 'Instrucoes para o agente que cria mensagens de abordagem para novos leads.',
    placeholder:
      'Ex: Foco total em agendar uma reuniao. Use um tom consultivo e foque na dor de falta de automação.',
    trainingExamples: [
      {
        title: 'Abordagem segura',
        prompt:
          'Gere mensagens consultivas e moderadas. Nunca prometa resultado garantido, não use urgencia falsa e incentive o operador a revisar antes de enviar.',
      },
      {
        title: 'Convite leve',
        prompt:
          'Foque em uma dor provavel do segmento e feche com uma pergunta simples, sem insistencia ou sequencia agressiva.',
      },
    ],
  },
  scheduling: {
    moduleId: 'scheduling',
    moduleLabel: 'Agenda & Reservas',
    moduleDescription: 'Regras para marcação de horários e confirmação de visitas.',
    placeholder:
      'Ex: Nunca confirme um horário sem pedir o telefone. Sempre ofereça horários dentro da agenda operacional.',
    trainingExamples: [
      {
        title: 'Confirmação limpa',
        prompt:
          'Antes de confirmar um horário, valide nome, telefone, serviço, profissional quando aplicavel e preferência de periodo.',
      },
      {
        title: 'Sem conflito',
        prompt:
          'Quando não houver horário disponivel, ofereça ate duas alternativas proximas e evite confirmar fora da agenda operacional.',
      },
    ],
  },
  checkout: {
    moduleId: 'checkout',
    moduleLabel: 'Finalização de Compra',
    moduleDescription: 'Comportamento da IA no momento de fechar o pedido e gerar o link de pagamento.',
    placeholder:
      'Ex: Confirme todos os itens do pedido, entrega, frete e observação antes de gerar o link.',
    trainingExamples: [
      {
        title: 'Pedido completo',
        prompt:
          'Antes do checkout, confirme itens, quantidades, entrega ou retirada, endereço quando necessário, frete, observação do cliente e forma de pagamento.',
      },
      {
        title: 'Carrinho abandonado',
        prompt:
          'Em retomadas de carrinho, seja util e breve. Pergunte se o cliente precisa ajustar item, entrega ou pagamento antes de reenviar o link.',
      },
    ],
  },
  sales: {
    moduleId: 'sales',
    moduleLabel: 'Vendas & Negociação',
    moduleDescription: 'Regras para sugestão de links de pagamento e negociação de valores.',
    placeholder:
      'Ex: não aceite contrapropostas abaixo do limite aprovado. Sempre foque nos beneficios antes de gerar cobrança.',
    trainingExamples: [
      {
        title: 'Fechamento consultivo',
        prompt:
          'Ao sugerir cobrança, explique o valor de forma objetiva, reforce o beneficio principal e confirme se pode gerar o link.',
      },
      {
        title: 'Objeção de preço',
        prompt:
          'Se o cliente achar caro, não ofereça desconto automaticamente. Pergunte qual ponto ficou pesado e ofereça alternativa aprovada.',
      },
    ],
  },
  recovery: {
    moduleId: 'recovery',
    moduleLabel: 'Recuperação de cobrança',
    moduleDescription: 'Tom de voz para cobrança de boletos vencidos ou pagamentos pendentes.',
    placeholder:
      'Ex: Seja firme mas cordial. ofereça parcelamento apenas quando a politica permitir.',
    trainingExamples: [
      {
        title: 'cobrança cordial',
        prompt:
          'Use tom respeitoso, informe o título em aberto, evite constrangimento e ofereça ajuda para regularizar.',
      },
      {
        title: 'Promessa de pagamento',
        prompt:
          'Quando o cliente prometer pagamento, registre a data combinada e confirme o melhor canal para acompanhar.',
      },
    ],
  },
  channels: {
    moduleId: 'channels',
    moduleLabel: 'Canais',
    moduleDescription:
      'Orientações para mensagens ligadas a WhatsApp, Instagram e handoff entre canais.',
    placeholder:
      'Ex.: Confirmar sempre o canal preferido do cliente e não misturar threads entre números diferentes.',
    trainingExamples: [
      {
        title: 'Confirmação de canal',
        prompt:
          'Antes de enviar links ou dados sensíveis, confirme que o cliente está no número ou conta corretos.',
      },
    ],
  },
  alerts: {
    moduleId: 'alerts',
    moduleLabel: 'Alertas',
    moduleDescription:
      'Tom das mensagens automáticas de lembretes enviadas ao WhatsApp do operador.',
    placeholder:
      'Ex.: Mensagens curtas, horário local explícito e sem alarmismo quando o compromisso for rotineiro.',
    trainingExamples: [
      {
        title: 'Lembrete objetivo',
        prompt:
          'Use uma linha de contexto, uma linha com horário/data em linguagem natural e uma chamada para ação única.',
      },
    ],
  },
  team: {
    moduleId: 'team',
    moduleLabel: 'Equipe',
    moduleDescription:
      'Instruções quando a IA auxilia fluxos internos da equipe (convites, permissões, rotinas).',
    placeholder:
      'Ex.: Linguagem neutra, sem expor dados de outros usuários e sempre pedir confirmação antes de alterações sensíveis.',
    trainingExamples: [
      {
        title: 'Governança',
        prompt:
          'Priorize clareza sobre papéis (OWNER/ADMIN/AGENT) e evite prometer mudanças que dependem de um administrador.',
      },
    ],
  },
  billing: {
    moduleId: 'billing',
    moduleLabel: 'Faturamento',
    moduleDescription:
      'Como a IA explica consumo, limites do plano e mudanças de assinatura.',
    placeholder:
      'Ex.: Ser transparente sobre limites e próximo ciclo sem criar urgência artificial.',
    trainingExamples: [
      {
        title: 'Upgrade consultivo',
        prompt:
          'Explique ganhos claros em capacidade antes de sugerir upgrade e mencione que add-ons podem incidir à parte.',
      },
    ],
  },
  widget: {
    moduleId: 'widget',
    moduleLabel: 'Widget de Chat',
    moduleDescription: 'Define como a IA responde no widget de chat instalado no site do negócio.',
    placeholder:
      'Ex.: Seja direto e acolhedor. Colete o contato do visitante antes de aprofundar o atendimento.',
    trainingExamples: [
      {
        title: 'Primeira impressão',
        prompt:
          'Cumprimente o visitante pelo nome se disponível, explique brevemente o que pode ajudar e pergunte em qual assunto posso ajudar.',
      },
      {
        title: 'Qualificação de lead',
        prompt:
          'Colete nome, telefone e necessidade principal antes de aprofundar. Se não conseguir, direcione para o WhatsApp ou formulário de contato.',
      },
    ],
  },
};
