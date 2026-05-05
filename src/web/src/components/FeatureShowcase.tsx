import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Package,
  RefreshCcw,
  ShoppingCart,
  Calendar,
  CreditCard,
  Search,
  Bell,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

interface ApiFeature {
  title: string;
  description: string;
  items: string[];
}

interface FeatureSectionProps {
  title: string;
  description: string;
  image: string;
  icon: any;
  index: number;
  highlight: string;
  benefits: string[];
  apiFeatures: ApiFeature;
}

const FeatureSection = ({ title, description, image, icon: Icon, index, highlight, benefits, apiFeatures }: FeatureSectionProps) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const isEven = index % 2 === 0;

  return (
    <div ref={ref} className="min-h-[80vh] flex items-center py-12 lg:py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-32 items-center">
        {/* Content Side */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={`${!isEven ? "lg:order-2" : ""}`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-[10px] font-bold tracking-[0.2em] uppercase enterprise-border rounded-full bg-primary/5 text-primary/80">
            <Icon className="w-3.5 h-3.5" />
            {highlight}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter mb-8 leading-[1.1] text-balance">
            {title}
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground/80 mb-10 leading-relaxed max-w-xl text-pretty">
            {description}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {benefits.map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i }}
                className="flex items-start gap-3 text-sm font-medium text-foreground/70"
              >
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                {benefit}
              </motion.div>
            ))}
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <motion.button
                whileHover={{ x: 10 }}
                className="inline-flex items-center gap-3 group text-primary font-bold text-sm tracking-tight"
              >
                Conhecer em detalhes <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[540px] bg-[#080c0d] border-white/5 text-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_0_120px_rgba(0,0,0,0.9)] outline-none overflow-hidden">
              <DialogHeader className="mb-8 relative text-left">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3.5 h-3.5 text-[#00C59E]">
                    <Icon className="w-full h-full" />
                  </div>
                  <span className="text-[9px] font-black text-[#00C59E] uppercase tracking-[0.3em]">Documentação Técnica</span>
                </div>

                <DialogTitle className="text-4xl font-black tracking-tighter text-white leading-tight mb-4">
                  {apiFeatures.title}
                </DialogTitle>

                <DialogDescription className="text-base text-white/50 leading-relaxed font-medium text-pretty">
                  {apiFeatures.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-10">
                <div>
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-6">Principais Benefícios:</p>
                  <div className="space-y-4">
                    {benefits.map((benefit: string, i: number) => (
                      <div key={i} className="flex items-start gap-4 group">
                        <div className="w-7 h-7 rounded-full bg-[#00C59E]/10 flex items-center justify-center shrink-0 border border-[#00C59E]/20 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00C59E]" />
                        </div>
                        <span className="text-[15px] font-bold text-white/80 tracking-tight leading-relaxed">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <DialogTrigger asChild>
                    <button
                      className="w-full py-5 rounded-2xl bg-[#00C59E] text-black font-black text-xs uppercase tracking-[0.3em] hover:brightness-110 hover:scale-[1.01] active:scale-[0.98] transition-all shadow-[0_20px_40px_-10px_rgba(0,197,158,0.4)] flex items-center justify-center"
                    >
                      ENTENDI, FECHAR
                    </button>
                  </DialogTrigger>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        </motion.div>

        {/* Visual Side */}
        <div className={`relative ${!isEven ? "lg:order-1" : ""}`}>
          <motion.div
            style={{ y }}
            className="relative z-10"
          >
            {/* Mac-style Window Frame */}
            <div className="enterprise-card rounded-2xl overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5),0_30px_60px_-30px_rgba(0,0,0,0.6)] border-primary/10">
              <div className="h-8 bg-muted/30 border-b border-primary/5 px-4 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20" />
                </div>
                <div className="mx-auto text-[10px] font-medium text-muted-foreground/40 tracking-wider uppercase">atendeai.io / {highlight.toLowerCase()}</div>
              </div>
              <div className="aspect-[16/10] overflow-hidden bg-black/5">
                <img
                  src={image}
                  alt={title}
                  className="w-full h-full object-cover object-top hover:scale-[1.02] transition-transform duration-700 ease-out"
                />
              </div>
            </div>

            {/* Premium floating stats card */}
            <motion.div
              style={{ y: useTransform(scrollYProgress, [0, 1], [50, -50]) }}
              className="absolute -right-8 -bottom-8 z-20 glass-surface p-5 rounded-2xl hidden xl:block border-primary/10 shadow-2xl"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-0.5">{highlight}</p>
                  <p className="text-sm font-bold text-foreground">Sistema Ativo</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Intense light flares */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] -z-1 pointer-events-none">
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className={`absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(168_100%_36%/0.2),transparent_70%)]`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const FeatureShowcase = () => {
  const sections = [
    {
      title: "Cérebro Operacional",
      description: "Uma visão 360º de toda a sua operação comercial. Acompanhe métricas, funis de conversão e a performance da sua IA em tempo real.",
      image: "/images/snapshots/dashboard.png",
      icon: LayoutDashboard,
      highlight: "Hub Central",
      benefits: [
        "Métricas em tempo real",
        "Visão unificada multitenant",
        "Gráficos de performance comercial"
      ],
      apiFeatures: {
        title: "API de Métricas e Multitenancy",
        description: "Explore o coração da operação com dados processados em real-time a partir da nossa API corporativa.",
        items: [
          "Métricas de Vendas (Receita, conversões, tickets) unificadas",
          "Gestão e hierarquia corporativa multitenant com múltiplos usuários e filiais",
          "Painel centralizado de Integrações (WhatsApp, Meta Ads, Calendários)",
          "Controle de regras de restrições de permissão e acesso de usuários"
        ]
      }
    },
    {
      title: "Atendimento Omnichannel",
      description: "Conecte WhatsApp e Instagram em um único fluxo inteligente. A IA conversa com tom humano, respeita guardrails e escala para o seu time apenas quando necessário.",
      image: "/images/snapshots/messaging.png",
      icon: MessageSquare,
      highlight: "Conversacional",
      benefits: [
        "Integração WhatsApp & Instagram",
        "IA com contexto empresarial",
        "Handoff humano transparente"
      ],
      apiFeatures: {
        title: "API de Mensageria Unificada",
        description: "Comunicação transparente através de webhooks processados de forma escalável e elástica.",
        items: [
          "Recepção assíncrona de Webhooks do WhatsApp Cloud API e Instagram Graph",
          "Envio automatizado de Mensagens de Texto, Áudios, Imagens, Documentos e Templates interativos",
          "Transbordo inteligente (Handoff Automático) transferindo a conversa da IA para um Humano Livre",
          "Resolução unificada de incidentes com Caixa de Entrada Dinâmica"
        ]
      }
    },
    {
      title: "Sincronização de Estoque",
      description: "O AtendeAí conhece seu estoque. Ele responde disponibilidade, sugere alternativas e sincroniza as vendas físicas e digitais sem erros.",
      image: "/images/snapshots/stock.png",
      icon: Package,
      highlight: "Inventário Realtime",
      benefits: [
        "Sincronização bidirecional",
        "Previsão de demanda com IA",
        "Alertas de ruptura"
      ],
      apiFeatures: {
        title: "API de Inventário & Catálogo",
        description: "Controle e auditoria de cada SKU validado fisicamente e em todos os micro-stores.",
        items: [
          "Criação e manipulação programática de Catálogos Corporativos",
          "Fluxos validados de Movimentações (Entrada, Saída, Ajustes) salvos em relatórios imutáveis",
          "Observabilidade proativa baseada em alertas de limite mínimo de unidades nas filiais",
          "Pesquisa semântica direta executada pela IA para responder aos usuários no chat ao vivo"
        ]
      }
    },
    {
      title: "Checkout Conversacional",
      description: "Não perca o cliente na troca de abas. O checkout acontece direto na conversa, de forma fluida, segura e extremamente rápida.",
      image: "/images/snapshots/checkout.png",
      icon: ShoppingCart,
      highlight: "Conversão Direta",
      benefits: [
        "Carrinho integrado ao chat",
        "Calculo de frete e taxas",
        "Finalização sem fricção"
      ],
      apiFeatures: {
        title: "API de Comércio Interativo",
        description: "Ecossistema fechado de compras que remove o atrito tradicional dos e-commerces convencionais.",
        items: [
          "Construção de Carrinhos via IA sem expor o cliente ao fluxo de Checkout web tradicional",
          "Motor integrado de checagem e alocação de SKUs para prevenir duplas vendas no catálogo",
          "Gestão Completa do Pedido (Pagamento Pendente, Envio, Entrega, Cancelamento)",
          "Plataforma fluida capaz de absorver ordens diretamente via disparos das integrações externas"
        ]
      }
    },
    {
      title: "Recuperação de Vendas",
      description: "O motor de recovery mais potente do mercado. Identificamos abandonos e agimos imediatamente com scripts persuasivos via IA.",
      image: "/images/snapshots/recovery.png",
      icon: RefreshCcw,
      highlight: "Revenue Recovery",
      benefits: [
        "Recuperação de Boletos & PIX",
        "Abordagem comportamental",
        "Dashboards de receita recuperada"
      ],
      apiFeatures: {
        title: "API de Conversão e Retenção",
        description: "Recupere o faturamento deixado na mesa com algoritmos otimizados de persuasão.",
        items: [
          "Identificação e Listagem Automática (Tracking) de intenções de abandono de Carrinho no chat",
          "Deduplicação Inteligente de disparos de recuperação nos Canais adequados (WhatsApp)",
          "Resgate autônomo de Links de Pagamento pendentes, expirados e vencimentos próximos",
          "Dashboards estatísticos rastreando individualmente o Retorno Sob o Esforço (ROAS) de remarketing"
        ]
      }
    },
    {
      title: "Pagamentos Irresistíveis",
      description: "Gere links de pagamento profissionais no contexto da venda. Suporte a PIX, Cartão e Boleto com confirmação instantânea no chat.",
      image: "/images/snapshots/payment_link.png",
      icon: CreditCard,
      highlight: "Financeiro",
      benefits: [
        "Links de pagamento dinâmicos",
        "Confirmação de recebimento",
        "Split de pagamentos nativo"
      ],
      apiFeatures: {
        title: "API Transacional e Pagamentos",
        description: "Processamento e controle de capital fluindo de ponta a ponta desde o Chat.",
        items: [
          "Geração dinâmica e infinita de Cobranças contendo métodos Flexíveis (Credito/Pix/Ticket)",
          "Motor de Split nativamente processado alocando pagamentos a unidades franqueadas simultaneamente",
          "Capacidade preditiva orientada a IA que analisa a taxa de aprovação para recomendar meios de pagamento",
          "Endpoints geradores permitindo suspensões instantâneas ou cancelamentos de propostas transientes"
        ]
      }
    },
    {
      title: "Agendamento Inteligente",
      description: "Sua agenda viva. A IA consulta horários, agenda serviços e envia lembretes para garantir que seu cliente nunca falte.",
      image: "/images/snapshots/scheduling.png",
      icon: Calendar,
      highlight: "Scheduling",
      benefits: [
        "Consulta de agenda realtime",
        "Lembretes de confirmação",
        "Gestão de profissionais"
      ],
      apiFeatures: {
        title: "API de Reservas de Infraestrutura",
        description: "Motor completo e resiliente conectando diretamente ao Google Calendar.",
        items: [
          "Handshake imediato via OAuth2 provendo leitura dos calendários protegidos das filiais",
          "Garantias algoritmicas e exclusão mútua eliminando acidentes de conflito de agenda (Overbookings)",
          "Escalonamento do Staffing avaliando agenda de colaboradores distintos antes de assumir e preencher blocos",
          "Notificação em cadência engatilhada contra Ausências minimizando a perda dos profissionais no horário"
        ]
      }
    },
    {
      title: "Prospecção de Leads",
      description: "Saia do passivo. O AtendeAí encontra empresas e leads ideais, cria campanhas de prospecção e traz novas oportunidades todos os dias.",
      image: "/images/snapshots/prospect.png",
      icon: Search,
      highlight: "Growth",
      benefits: [
        "Busca de leads qualificados",
        "Outreach automático",
        "Enriquecimento de dados"
      ],
      apiFeatures: {
        title: "API de Inteligência Demográfica",
        description: "Extração ativa e conversão de visitantes com integração de Webhooks em publicidade.",
        items: [
          "Importação Autônoma provida através da Ponte oficial do LeadAds da Meta para dentro do CRM local",
          "Máquinas Automáticas de Engajamento despachando e-mails/templates nos primeiros milissegundos do opt-in",
          "Qualificador Sistêmico bloqueando contatos irregulares e preservando o Rating da organização",
          "Agregações Analíticas para visualizações aprofundadas por campanha (CAC, CPA e Converted Events)"
        ]
      }
    },
    {
      title: "Alertas & Monitoramento",
      description: "Fique por dentro de cada movimento importante. Notificações inteligentes sobre vendas críticas, falhas ou pedidos de ajuda humana.",
      image: "/images/snapshots/alerts.png",
      icon: Bell,
      highlight: "Observabilidade",
      benefits: [
        "Alertas push & WhatsApp",
        "Monitoramento de saúde de IA",
        "Log de auditoria completo"
      ],
      apiFeatures: {
        title: "API de Telemetria e Políticas",
        description: "Controle as rédeas da operação digital, delimitando a inteligência e mapeando intercorrências.",
        items: [
          "Modificador semântico via Prompts Sistêmicos estritos assegurando os limites (Guardrails) de fala da IA",
          "Emissão programática de Push Alarms alertando os encarregados da filial frente a desvios na negociação",
          "Logs extensivos englobos pela Central captando assinaturas financeiras em transação dentro do Hub",
          "Auditorias permanentes do Workspace com proteção dos artefatos corporativos (Roles e Acessos)"
        ]
      }
    }
  ];

  return (
    <div className="relative">
      {/* Background line decoration with moving light */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent -translate-x-1/2 opacity-30 hidden lg:block overflow-hidden">
        <motion.div
          animate={{ y: ["-100%", "200%"] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 w-full h-40 bg-gradient-to-b from-transparent via-primary/60 to-transparent"
        />
      </div>

      {sections.map((section, i) => (
        <FeatureSection key={i} {...section} index={i} />
      ))}
    </div>
  );
};

export default FeatureShowcase;
