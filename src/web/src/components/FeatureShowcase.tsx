import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  RefreshCcw,
  ShoppingCart,
  Calendar,
  CreditCard,
  Search,
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

interface FeatureSectionProps {
  title: string;
  description: string;
  image: string;
  icon: any;
  index: number;
  highlight: string;
  benefits: string[];
  detailTitle: string;
  detailDescription: string;
  slug?: string;
}

const FeatureSection = ({ title, description, image, icon: Icon, index, highlight, benefits, detailTitle, detailDescription, slug }: FeatureSectionProps) => {
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

          <div className="flex flex-wrap items-center gap-5">
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
                    <span className="text-[9px] font-black text-[#00C59E] uppercase tracking-[0.3em]">Resumo do módulo</span>
                  </div>

                  <DialogTitle className="text-4xl font-black tracking-tighter text-white leading-tight mb-4">
                    {detailTitle}
                  </DialogTitle>

                  <DialogDescription className="text-base text-white/50 leading-relaxed font-medium text-pretty">
                    {detailDescription}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-10">
                  <div>
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-6">Principais benefícios:</p>
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

            {slug && (
              <Link
                to={`/solucoes/${slug}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors group"
              >
                Ver solução
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
          </div>
        </motion.div>

        <div className={`relative ${!isEven ? "lg:order-1" : ""}`}>
          <motion.div
            style={{ y }}
            className="relative z-10"
          >
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
                  <p className="text-sm font-bold text-foreground">Módulo ativo</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%] -z-1 pointer-events-none">
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(168_100%_36%/0.2),transparent_70%)]"
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
      title: "Atendimento com IA e handoff humano",
      description: "Concentre a operação comercial em uma inbox única com IA, contexto do negócio e transbordo para o time sempre que a conversa precisar.",
      image: "/images/snapshots/dashboard.png",
      icon: LayoutDashboard,
      highlight: "Inbox operacional",
      slug: "clinicas-saude",
      benefits: [
        "Inbox única para atendimento e operação",
        "IA assistida com histórico do contato",
        "Handoff humano sem perder contexto"
      ],
      detailTitle: "Atendimento, contexto e operação no mesmo lugar",
      detailDescription: "A plataforma reúne atendimento, histórico, IA e operação comercial sem exigir vários sistemas paralelos.",
    },
    {
      title: "CRM, qualificação e histórico do contato",
      description: "Organize leads, clientes, oportunidades e próximos passos com playbooks mais consistentes e menos retrabalho no comercial.",
      image: "/images/snapshots/messaging.png",
      icon: MessageSquare,
      highlight: "CRM comercial",
      slug: "servicos-b2b",
      benefits: [
        "Histórico da conversa e do relacionamento",
        "Qualificação por contexto e necessidade",
        "Mais clareza para operar funil e retorno"
      ],
      detailTitle: "Contatos mais organizados, menos achismo",
      detailDescription: "O CRM deixa de ser uma lista solta e passa a apoiar atendimento, venda, cobrança, agenda e pós-venda.",
    },
    {
      title: "Propostas, aceite e pagamento",
      description: "Monte propostas comerciais, envie jornadas públicas de aceite e siga para pagamento sem depender de arquivos soltos ou processos manuais.",
      image: "/images/snapshots/stock.png",
      icon: FileText,
      highlight: "Propostas",
      slug: "advocacia",
      benefits: [
        "Orçamentos e propostas organizados",
        "Aceite em jornada pública",
        "Pagamento conectado ao fluxo comercial"
      ],
      detailTitle: "Do orçamento ao pagamento no mesmo fluxo",
      detailDescription: "A proposta deixa de ser um anexo perdido e passa a participar da jornada comercial até o pagamento.",
    },
    {
      title: "Checkout, links de pagamento e promoções",
      description: "Venda por conversa com carrinho, checkout, links de pagamento, cupons e campanhas sem empurrar o cliente para um fluxo quebrado.",
      image: "/images/snapshots/checkout.png",
      icon: ShoppingCart,
      highlight: "Conversão",
      slug: "ecommerce",
      benefits: [
        "Checkout conversacional e links rápidos",
        "Cupons, promoções e campanhas",
        "Entrega, frete e acompanhamento do pedido"
      ],
      detailTitle: "Pagamento mais perto da conversa",
      detailDescription: "A plataforma ajuda a fechar pedido e receber com menos fricção, menos troca de canal e mais contexto comercial.",
    },
    {
      title: "Cobrança, recovery e receita recuperada",
      description: "Organize carteira, negociações, promessas e recebimentos com visão mais clara do que é nova venda e do que é recuperação de receita.",
      image: "/images/snapshots/recovery.png",
      icon: RefreshCcw,
      highlight: "Recovery",
      slug: "imobiliarias",
      benefits: [
        "Carteira de cobrança com histórico",
        "Régua de follow-up e promessas",
        "Relatórios de receita recuperada"
      ],
      detailTitle: "Cobrança com operação, não improviso",
      detailDescription: "O recovery entra como processo controlado, com métricas, status e ações claras para o time.",
    },
    {
      title: "Agenda, disponibilidade e confirmação",
      description: "Consulte horários, profissionais, reservas, reagendamento, lembretes e até pagamento antecipado em serviços que dependem de agenda.",
      image: "/images/snapshots/payment_link.png",
      icon: Calendar,
      highlight: "Scheduling",
      slug: "clinicas-saude",
      benefits: [
        "Agenda por profissional e categoria",
        "Lembretes e confirmações automáticas",
        "Google Calendar, Meet e pré-pagamento"
      ],
      detailTitle: "Agenda operacional conectada à conversa",
      detailDescription: "A jornada de agendamento fica integrada ao atendimento, à disponibilidade real e ao pagamento quando necessário.",
    },
    {
      title: "Prospecção e novas oportunidades",
      description: "Saia do atendimento passivo com qualificação de leads, campanhas outbound e motor de prospecção para gerar nova demanda comercial.",
      image: "/images/snapshots/prospect.png",
      icon: Search,
      highlight: "Prospecção",
      slug: "servicos-b2b",
      benefits: [
        "Qualificação de leads por contexto",
        "Busca e segmentação de oportunidades",
        "Mais previsibilidade para o time comercial"
      ],
      detailTitle: "Mais que atendimento: geração de demanda",
      detailDescription: "A plataforma também apoia operações que precisam abrir novas oportunidades, não só responder quem já chegou.",
    },
    {
      title: "Dashboards, roteamento e governança",
      description: "Acompanhe operação, distribua conversas, conecte módulos e tenha uma visão mais madura da máquina comercial por trás do atendimento.",
      image: "/images/snapshots/alerts.png",
      icon: CreditCard,
      highlight: "Operação",
      slug: "educacao",
      benefits: [
        "Roteamento de equipe por regra",
        "Relatórios avançados por operação",
        "Hub de integrações para escalar"
      ],
      detailTitle: "A operação cresce com mais controle",
      detailDescription: "À medida que a rotina comercial amadurece, a plataforma ajuda a dar mais governança, visibilidade e coordenação ao time.",
    }
  ];

  return (
    <div className="relative">
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
