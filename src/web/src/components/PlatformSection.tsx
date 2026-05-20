import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import {
  BrainCircuit,
  Target,
  Receipt,
  TrendingUp,
  MessageSquare,
  Package,
  Calendar,
  CreditCard,
  ShoppingCart,
  Scissors,
  Search,
  BarChart3,
} from "lucide-react";

const pillars = [
  {
    icon: Package,
    accent: MessageSquare,
    title: "Varejo & Estoque",
    desc: "Para operações que precisam responder catálogo, disponibilidade, carrinho, pagamento e entrega com mais contexto comercial.",
    highlights: ["Catálogo e estoque", "Checkout conversacional", "Entrega e frete"],
  },
  {
    icon: ShoppingCart,
    accent: TrendingUp,
    title: "E-commerce, Food & Delivery",
    desc: "Para quem vende com pedido, carrinho, cupom, entrega, frete e retomada de abandono sem perder o cliente na conversa.",
    highlights: ["Carrinho abandonado", "Cupons e promoções", "Pedidos e entrega"],
  },
  {
    icon: BrainCircuit,
    accent: Target,
    title: "Serviços consultivos e B2B",
    desc: "Para negócios que precisam qualificar demanda, gerar propostas, acompanhar retorno comercial e organizar pipeline com mais clareza.",
    highlights: ["Qualificação de leads", "Orçamentos e propostas", "Motor de prospecção"],
  },
  {
    icon: Calendar,
    accent: Receipt,
    title: "Agendamento Online",
    desc: "Para clínicas, studios e operações por horário. A plataforma consulta agenda, reserva, confirma, lembra e reduz faltas com menos atrito.",
    highlights: ["Agenda profissional", "Lembretes e confirmações", "Pagamento antecipado"],
  },
  {
    icon: Scissors,
    accent: Calendar,
    title: "Beleza, Pet & Studios",
    desc: "Para serviços recorrentes por profissional, unidade e horário, com foco em confirmação, retorno e venda de recorrência.",
    highlights: ["Profissionais", "Recorrência", "Redução de no-show"],
  },
  {
    icon: CreditCard,
    accent: TrendingUp,
    title: "Cobrança e Recovery",
    desc: "Para operações que precisam cobrar, negociar, acompanhar promessas e medir recuperação de receita com mais governança.",
    highlights: ["Carteira de cobrança", "Régua de cobrança", "Links de pagamento"],
  },
  {
    icon: Search,
    accent: Target,
    title: "Prospecção e Qualificação",
    desc: "Para equipes que precisam gerar oportunidades, qualificar demanda e manter histórico comercial antes da proposta.",
    highlights: ["Motor de prospecção", "Qualificação de leads", "Pipeline comercial"],
  },
  {
    icon: BarChart3,
    accent: Receipt,
    title: "Gestão, Relatórios e Integrações",
    desc: "Para acompanhar operação, equipes, filiais, canais e módulos com mais controle à medida que a empresa cresce.",
    highlights: ["Roteamento de equipe", "Relatórios avançados", "Hub de integrações"],
  },
];

const PlatformSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);

  return (
    <section ref={ref} className="px-6 py-[16vh] relative overflow-hidden">
      <motion.div style={{ y: bgY }} className="absolute inset-0 -top-[20%] -bottom-[20%]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(168_100%_36%/0.06)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(200_60%_30%/0.05)_0%,transparent_50%)]" />
      </motion.div>

      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[conic-gradient(from_0deg,transparent,hsl(168_100%_36%/0.03),transparent,hsl(168_100%_36%/0.05),transparent)] blur-[60px]"
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-left mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-xs font-semibold tracking-widest uppercase enterprise-border rounded-full bg-primary/5 text-primary">
            <BrainCircuit className="w-3.5 h-3.5" />
            Plataforma completa
          </div>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter mb-4">
            Uma <span className="text-gradient-primary">operação comercial</span> completa
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Atendimento, agenda, propostas, pagamento, cobrança, prospecção e operação conectados em um único fluxo.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {pillars.map((p, i) => {
            const Icon = p.icon;
            const AccentIcon = p.accent;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -5, transition: { duration: 0.25 } }}
                className="group relative enterprise-card rounded-2xl p-8 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                {/* Border light sweep effect */}
                <motion.div
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 + i * 0.5 }}
                  className="absolute top-0 left-0 w-1/3 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                />
                <motion.div
                  animate={{ y: ["-100%", "200%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 + i * 0.5 }}
                  className="absolute top-0 right-0 w-px h-1/3 bg-gradient-to-b from-transparent via-primary/50 to-transparent"
                />
                <div className="absolute top-4 right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <AccentIcon className="w-24 h-24 text-primary" />
                </div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-5 group-hover:from-primary/25 group-hover:to-primary/10 transition-all duration-300">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-foreground">{p.title}</h3>
                  <p className="text-muted-foreground leading-relaxed mb-5 text-sm">{p.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.highlights.map((h, j) => (
                      <span key={j} className="text-xs font-medium px-2.5 py-1 rounded-full enterprise-border bg-primary/5 text-primary">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PlatformSection;
