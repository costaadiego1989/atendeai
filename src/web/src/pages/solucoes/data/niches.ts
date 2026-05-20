import {
  Stethoscope,
  Building2,
  ShoppingBag,
  Briefcase,
  Scale,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

export interface NicheStat {
  value: string;
  label: string;
}

export interface NichePain {
  title: string;
  description: string;
}

export interface NicheUseCase {
  title: string;
  description: string;
}

export interface NicheFAQItem {
  question: string;
  answer: string;
}

export interface NicheData {
  slug: string;
  name: string;
  icon: LucideIcon;
  gradient: string;
  hero: {
    eyebrow: string;
    title: string;
    titleHighlight: string;
    subtitle: string;
  };
  stats: NicheStat[];
  pains: NichePain[];
  useCases: NicheUseCase[];
  integrations: string[];
  faq: NicheFAQItem[];
}

export const niches: NicheData[] = [
  {
    slug: "clinicas-saude",
    name: "Clínicas e Saúde",
    icon: Stethoscope,
    gradient: "from-emerald-500 to-teal-600",
    hero: {
      eyebrow: "Para clínicas, consultórios e profissionais de saúde",
      title: "Atendimento inteligente para",
      titleHighlight: "clínicas e saúde",
      subtitle:
        "Pacientes atendidos em segundos, triagem automática, agendamento nativo e follow-up sem depender de secretária. Sua clínica funcionando 24/7.",
    },
    stats: [
      { value: "<30s", label: "Tempo médio de resposta" },
      { value: "24/7", label: "Disponibilidade do agente" },
      { value: "85%", label: "Resolvido sem humano" },
    ],
    pains: [
      {
        title: "Lead perdido fora do horário",
        description:
          "Pacientes buscam atendimento à noite e nos finais de semana. Sem resposta imediata, vão para o concorrente.",
      },
      {
        title: "Follow-up manual e esquecido",
        description:
          "Confirmações de consulta, retornos e pós-atendimento dependem de ligações manuais que nunca acontecem.",
      },
      {
        title: "Secretária sobrecarregada",
        description:
          "O volume de mensagens no WhatsApp cresce, mas a equipe não acompanha. Pacientes esperam horas por resposta.",
      },
    ],
    useCases: [
      {
        title: "Agente IA 24/7",
        description:
          "Responde dúvidas sobre procedimentos, valores e disponibilidade a qualquer hora do dia.",
      },
      {
        title: "Triagem via conversa",
        description:
          "Coleta sintomas, urgência e preferências antes de encaminhar para o profissional certo.",
      },
      {
        title: "Agendamento nativo",
        description:
          "Paciente escolhe profissional, horário e confirma a consulta direto no chat, sem formulários.",
      },
      {
        title: "Follow-up automático",
        description:
          "Lembretes de consulta, pós-atendimento e retorno agendados automaticamente.",
      },
    ],
    integrations: [
      "WhatsApp Business",
      "Instagram DM",
      "Google Calendar",
      "Sistemas de prontuário",
    ],
    faq: [
      {
        question: "Funciona com meu sistema de prontuário?",
        answer:
          "A plataforma se integra via API com os principais sistemas de gestão clínica. O agendamento e histórico ficam sincronizados.",
      },
      {
        question: "O agente IA pode dar diagnósticos?",
        answer:
          "Não. O agente faz triagem e coleta informações, mas nunca dá diagnósticos. Ele encaminha para o profissional adequado com todo o contexto.",
      },
      {
        question: "Como funciona o agendamento?",
        answer:
          "O paciente vê horários disponíveis por profissional, escolhe e confirma. Lembretes automáticos reduzem faltas em até 40%.",
      },
    ],
  },
  {
    slug: "imobiliarias",
    name: "Imobiliárias",
    icon: Building2,
    gradient: "from-blue-500 to-indigo-600",
    hero: {
      eyebrow: "Para imobiliárias, corretores e incorporadoras",
      title: "Converta leads em visitas para",
      titleHighlight: "imobiliárias",
      subtitle:
        "O primeiro corretor que responde fecha 78% das vendas. Com IA, seu lead é atendido em segundos, qualificado e distribuído para o corretor certo.",
    },
    stats: [
      { value: "21x", label: "Mais conversão em <5min" },
      { value: "<30s", label: "Tempo de primeira resposta" },
      { value: "78%", label: "Fecha quem responde primeiro" },
    ],
    pains: [
      {
        title: "Corretor não vence o volume",
        description:
          "Portais geram dezenas de leads por dia. Sem resposta rápida, o lead esfria em minutos.",
      },
      {
        title: "Lead frio após 1 hora",
        description:
          "Estudos mostram que após 5 minutos sem resposta, a chance de conversão cai 21x. Após 1h, o lead já foi para outro.",
      },
      {
        title: "Follow-up esquecido",
        description:
          "Corretores focam nos leads quentes e esquecem de nutrir os que não converteram de primeira.",
      },
    ],
    useCases: [
      {
        title: "Qualificação automática",
        description:
          "IA coleta orçamento, região, tipo de imóvel e urgência antes de passar para o corretor.",
      },
      {
        title: "Busca de imóveis via agente",
        description:
          "Cliente descreve o que quer e o agente sugere opções do catálogo com fotos e valores.",
      },
      {
        title: "Distribuição por setor",
        description:
          "Leads são roteados automaticamente para o corretor responsável pela região ou tipo de imóvel.",
      },
      {
        title: "Follow-up multi-toque",
        description:
          "Cadência automática: WhatsApp dia 1, email dia 3, ligação dia 7 até o lead responder.",
      },
    ],
    integrations: [
      "WhatsApp Business",
      "Portais (ZAP, OLX, VivaReal)",
      "CRMs imobiliários",
      "Google Calendar",
    ],
    faq: [
      {
        question: "Integra com portais imobiliários?",
        answer:
          "Sim. Leads de ZAP Imóveis, OLX, VivaReal e outros portais entram automaticamente e são atendidos pelo agente IA.",
      },
      {
        question: "O corretor perde o controle?",
        answer:
          "Não. O agente qualifica e distribui, mas o corretor tem acesso total ao histórico e pode assumir a conversa a qualquer momento.",
      },
      {
        question: "Funciona para locação e venda?",
        answer:
          "Sim. O agente adapta o fluxo de qualificação conforme o tipo de negócio — locação tem perguntas diferentes de venda.",
      },
    ],
  },
  {
    slug: "ecommerce",
    name: "Ecommerce",
    icon: ShoppingBag,
    gradient: "from-rose-500 to-pink-600",
    hero: {
      eyebrow: "Para lojas online, marketplaces e D2C",
      title: "Venda mais com atendimento IA para",
      titleHighlight: "ecommerce",
      subtitle:
        "Chat no site, WhatsApp inteligente, catálogo conversacional e carrinho no chat. Seu cliente compra sem sair da conversa.",
    },
    stats: [
      { value: "<30s", label: "Resposta ao cliente" },
      { value: "2.4x", label: "Mais conversão com chat" },
      { value: "85%", label: "Atendido sem humano" },
    ],
    pains: [
      {
        title: "Cliente sai sem comprar",
        description:
          "67% dos carrinhos são abandonados. Sem atendimento proativo, a venda se perde.",
      },
      {
        title: "SAC gargalo em campanha",
        description:
          "Black Friday, lançamentos e promoções geram picos que o time não absorve.",
      },
      {
        title: "WhatsApp desorganizado",
        description:
          "Pedidos, dúvidas e reclamações misturados no mesmo número sem controle nem métricas.",
      },
    ],
    useCases: [
      {
        title: "Chat embed no site",
        description:
          "Widget inteligente que aborda o visitante, tira dúvidas sobre produtos e empurra para a compra.",
      },
      {
        title: "Agente IA no WhatsApp",
        description:
          "Atende dúvidas de produto, status de pedido, trocas e devoluções automaticamente.",
      },
      {
        title: "Catálogo conversacional",
        description:
          "Cliente navega produtos, vê fotos e preços direto no chat sem precisar abrir o site.",
      },
      {
        title: "Carrinho no chat",
        description:
          "Monta pedido, aplica cupom e gera link de pagamento sem sair da conversa.",
      },
    ],
    integrations: [
      "WhatsApp Business",
      "Shopify",
      "WooCommerce",
      "Mercado Livre",
      "Nuvemshop",
    ],
    faq: [
      {
        question: "Integra com minha loja?",
        answer:
          "Sim. Conectamos com Shopify, WooCommerce, Nuvemshop, Mercado Livre e outras plataformas via API.",
      },
      {
        question: "O estoque fica sincronizado?",
        answer:
          "Sim. O módulo de inventário sincroniza estoque em tempo real. O agente nunca oferece produto indisponível.",
      },
      {
        question: "Funciona em campanhas de alto volume?",
        answer:
          "Sim. O agente IA escala automaticamente. Não importa se são 10 ou 10.000 mensagens simultâneas.",
      },
    ],
  },
  {
    slug: "servicos-b2b",
    name: "Serviços B2B",
    icon: Briefcase,
    gradient: "from-amber-500 to-orange-600",
    hero: {
      eyebrow: "Para consultorias, agências e prestadores de serviço",
      title: "Qualifique e converta leads para",
      titleHighlight: "serviços B2B",
      subtitle:
        "SDR com IA que qualifica leads 24/7, agenda reuniões e faz follow-up automático. Escale sua prospecção sem escalar o time.",
    },
    stats: [
      { value: "3x", label: "Mais reuniões qualificadas" },
      { value: "60%", label: "Economia vs SDR humano" },
      { value: "21x", label: "Conversão em <5min" },
    ],
    pains: [
      {
        title: "SDR caro e não escala",
        description:
          "Contratar SDRs é caro e o ramp-up leva meses. Enquanto isso, leads esfriam sem resposta.",
      },
      {
        title: "Reunião sem qualificação",
        description:
          "O time comercial perde tempo com reuniões que não têm fit. Sem filtro, a agenda lota de leads frios.",
      },
      {
        title: "Follow-up esquecido",
        description:
          "Após o primeiro contato, 80% dos deals morrem por falta de follow-up consistente.",
      },
    ],
    useCases: [
      {
        title: "Qualificação BANT",
        description:
          "IA coleta Budget, Authority, Need e Timeline antes de passar o lead para o closer.",
      },
      {
        title: "Propostas automáticas",
        description:
          "Gera e envia propostas comerciais personalizadas com base na qualificação do lead.",
      },
      {
        title: "Follow-up IA",
        description:
          "Cadência automática multi-canal que nutre o lead até ele estar pronto para comprar.",
      },
      {
        title: "Handoff inteligente",
        description:
          "Transfere para o closer com todo o contexto: dores, orçamento, urgência e histórico.",
      },
    ],
    integrations: [
      "WhatsApp Business",
      "Email",
      "Google Calendar",
      "CRMs (Pipedrive, HubSpot)",
    ],
    faq: [
      {
        question: "Substitui meu SDR?",
        answer:
          "Complementa. O agente IA faz a qualificação inicial e follow-up, liberando o SDR para focar em leads quentes e negociações complexas.",
      },
      {
        question: "Funciona para ticket alto?",
        answer:
          "Sim. Para vendas complexas, o agente qualifica e agenda. O closer entra já com contexto completo do lead.",
      },
      {
        question: "Integra com meu CRM?",
        answer:
          "Sim. Leads qualificados são sincronizados com Pipedrive, HubSpot ou seu CRM via API.",
      },
    ],
  },
  {
    slug: "advocacia",
    name: "Advocacia",
    icon: Scale,
    gradient: "from-slate-500 to-zinc-700",
    hero: {
      eyebrow: "Para escritórios de advocacia e advogados autônomos",
      title: "Triagem e captação inteligente para",
      titleHighlight: "advocacia",
      subtitle:
        "Agente IA que faz triagem de casos, coleta documentos, responde dúvidas básicas e encaminha para o advogado certo com todo o contexto.",
    },
    stats: [
      { value: "70%", label: "Triagem sem advogado" },
      { value: "24/7", label: "Atendimento inicial" },
      { value: "5h/sem", label: "Economizadas em triagem" },
    ],
    pains: [
      {
        title: "Triagem toma horas",
        description:
          "Advogados gastam horas respondendo perguntas básicas que poderiam ser filtradas automaticamente.",
      },
      {
        title: "Dúvidas básicas interrompendo",
        description:
          "Consultas sobre prazos, documentos necessários e valores tomam tempo que deveria ir para casos reais.",
      },
      {
        title: "Prospect sem retorno",
        description:
          "Potenciais clientes entram em contato e não recebem resposta rápida. Vão para outro escritório.",
      },
    ],
    useCases: [
      {
        title: "Triagem automática",
        description:
          "IA identifica área do direito, urgência e complexidade antes de encaminhar para o advogado.",
      },
      {
        title: "Coleta de documentos",
        description:
          "Agente solicita e recebe documentos necessários via chat antes da primeira consulta.",
      },
      {
        title: "Base de conhecimento jurídico",
        description:
          "Responde dúvidas frequentes sobre prazos, procedimentos e documentação com base no conhecimento do escritório.",
      },
      {
        title: "Handoff com contexto",
        description:
          "Advogado recebe o caso já com resumo, documentos e classificação de urgência.",
      },
    ],
    integrations: [
      "WhatsApp Business",
      "Email",
      "Google Drive",
      "Sistemas jurídicos",
    ],
    faq: [
      {
        question: "O agente dá consultoria jurídica?",
        answer:
          "Não. O agente faz triagem, coleta informações e responde dúvidas genéricas. Nunca dá parecer jurídico nem orientação sobre casos específicos.",
      },
      {
        question: "Funciona para qual área do direito?",
        answer:
          "Qualquer área. O agente é configurado com a base de conhecimento do seu escritório e adapta a triagem conforme suas especialidades.",
      },
      {
        question: "Os dados são seguros?",
        answer:
          "Sim. Dados são criptografados, isolados por tenant e em conformidade com LGPD. Sigilo profissional é preservado.",
      },
    ],
  },
  {
    slug: "educacao",
    name: "Educação",
    icon: GraduationCap,
    gradient: "from-violet-500 to-purple-600",
    hero: {
      eyebrow: "Para escolas, cursos, faculdades e EdTechs",
      title: "Captação e retenção inteligente para",
      titleHighlight: "educação",
      subtitle:
        "Agente IA que capta alunos, faz matrícula via conversa, combate evasão silenciosa e libera a secretaria para o que importa.",
    },
    stats: [
      { value: "2.5x", label: "Mais matrículas" },
      { value: "90%", label: "Atendido sem humano" },
      { value: "15%", label: "Menos evasão" },
    ],
    pains: [
      {
        title: "Captação sem velocidade",
        description:
          "Leads de campanhas chegam e ficam horas sem resposta. A concorrência responde primeiro e fecha.",
      },
      {
        title: "Evasão silenciosa",
        description:
          "Alunos desistem sem avisar. Quando a instituição percebe, já é tarde para recuperar.",
      },
      {
        title: "Secretaria afogada",
        description:
          "Dúvidas sobre matrícula, documentos, horários e valores sobrecarregam a equipe administrativa.",
      },
    ],
    useCases: [
      {
        title: "Agente de captação",
        description:
          "Responde dúvidas sobre cursos, valores e processo seletivo 24/7 com personalização.",
      },
      {
        title: "Matrícula via agente",
        description:
          "Coleta dados, documentos e gera link de pagamento da matrícula direto no chat.",
      },
      {
        title: "Follow-up anti-evasão",
        description:
          "Detecta sinais de desengajamento e aciona cadência de retenção automaticamente.",
      },
      {
        title: "Base acadêmica",
        description:
          "Responde sobre grade, horários, notas e procedimentos com base no conhecimento da instituição.",
      },
    ],
    integrations: [
      "WhatsApp Business",
      "Instagram DM",
      "Sistemas acadêmicos",
      "Google Calendar",
    ],
    faq: [
      {
        question: "Funciona para EAD e presencial?",
        answer:
          "Sim. O agente adapta o fluxo conforme a modalidade — EAD foca em acesso à plataforma, presencial em horários e localização.",
      },
      {
        question: "Como detecta risco de evasão?",
        answer:
          "Monitora sinais como falta de interação, atrasos em pagamento e ausências. Aciona cadência de retenção antes que o aluno desista.",
      },
      {
        question: "Integra com meu sistema acadêmico?",
        answer:
          "Sim. Conectamos via API com os principais sistemas de gestão acadêmica para sincronizar dados de alunos e matrículas.",
      },
    ],
  },
];
