import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import { 
  Target, 
  Zap, 
  ShieldCheck, 
  Briefcase, 
  Stethoscope, 
  Scissors, 
  ShoppingBag, 
  Wrench, 
  Smartphone,
  Dog,
  Shirt,
  Store,
  Home,
  Utensils,
  GraduationCap,
  Dumbbell,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

const differentials = [
  {
    icon: Target,
    title: "Não é só automação",
    desc: "É estratégia, organização e conversão. Entregamos uma operação comercial que vende por você.",
  },
  {
    icon: Zap,
    title: "Setup rápido e sem fricção",
    desc: "Em poucos dias seu atendimento, prospecção e cobrança já estão rodando no automático.",
  },
  {
    icon: ShieldCheck,
    title: "Sem compromisso",
    desc: "Se não fizer sentido para o seu negócio, você não continua. Simples assim.",
  },
];

const audiences = [
  { icon: Stethoscope, label: "Clínicas & Saúde" },
  { icon: Scissors, label: "Beleza & Estética" },
  { icon: Shirt, label: "Varejo & Moda" },
  { icon: Briefcase, label: "Advocacia & Consultores" },
  { icon: Dog, label: "Petshops & Vets" },
  { icon: Home, label: "Imobiliárias" },
  { icon: Utensils, label: "Restaurantes & Delivery" },
  { icon: GraduationCap, label: "Escolas & Cursos" },
  { icon: Dumbbell, label: "Academias & Studios" },
  { icon: Store, label: "E-commerce & Drop" },
];

const AboutSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  return (
    <section id="sobre" ref={ref} className="px-6 py-[16vh] relative overflow-hidden font-inter">
      <motion.div style={{ y: bgY }} className="absolute inset-0 -top-[20%] -bottom-[20%]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(168_100%_36%/0.06)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(168_100%_36%/0.04)_0%,transparent_50%)]" />
      </motion.div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-[10px] font-black tracking-[0.3em] uppercase enterprise-border rounded-full bg-[#00C59E]/5 text-[#00C59E]">
            <Zap className="w-3.5 h-3.5" />
            Nossa Visão
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-8 leading-tight">
            A maioria vende <span className="text-white/20 line-through">"chatbot"</span>.
            <br />
            Nós entregamos <span className="text-[#00C59E]">resultados</span>.
          </h2>
          <p className="text-lg md:text-xl text-white/40 font-medium max-w-3xl leading-relaxed">
            Nossa plataforma foi desenhada para transformar conversas em ativos de faturamento. Unificamos atendimento, prospecção e checkout em um fluxo autônomo e altamente eficiente.
          </p>
        </motion.div>

        {/* Target audience - High-Contrast Enterprise Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-24"
        >
          <div className="text-left mb-12 border-l-4 border-[#00C59E] pl-6">
            <h3 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2 uppercase">
              Onde o AtendeAí <span className="text-[#00C59E]">Domina</span>
            </h3>
            <p className="text-[#00C59E]/60 font-black text-xs tracking-[0.3em] uppercase">Especialistas treinados para converter no WhatsApp e Instagram.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {audiences.map((a, i) => {
              const Icon = a.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
                  whileHover={{ y: -6, borderColor: "rgba(0,197,158,0.4)" }}
                  className="group relative flex flex-col items-center justify-center p-8 rounded-[2rem] bg-[#0a0f10] border border-white/10 hover:border-[#00C59E]/40 transition-all duration-500 overflow-hidden cursor-pointer shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)]"
                >
                  {/* Constant subtle background glow */}
                  <div className="absolute inset-0 bg-[#00C59E]/[0.02]" />
                  
                  {/* Hover dynamic light */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#00C59E]/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                  <div className="relative z-10 flex flex-col items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#00C59E]/10 border border-[#00C59E]/20 flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-[0_0_20px_rgba(0,197,158,0.1)] group-hover:shadow-[0_0_30px_rgba(0,197,158,0.2)]">
                      <Icon className="w-8 h-8 text-[#00C59E] drop-shadow-[0_0_8px_rgba(0,197,158,0.5)]" />
                    </div>
                    
                    <span className="text-[11px] font-black text-white tracking-[0.15em] uppercase text-center transition-colors px-2 leading-tight">
                      {a.label}
                    </span>
                  </div>

                  {/* High-visibility active line */}
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-[#00C59E]/40 to-transparent opacity-30 group-hover:opacity-100 group-hover:via-[#00C59E] transition-all duration-500 shadow-[0_0_15px_#00C59E]" />
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Differentials - Unified Enterprise Style */}
        <div className="grid md:grid-cols-3 gap-6">
          {differentials.map((d, i) => {
            const Icon = d.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="group relative p-10 rounded-[2.5rem] bg-[#0d1112] border border-white/5 hover:border-[#00C59E]/30 transition-all duration-500 overflow-hidden"
              >
                {/* Background light source */}
                <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[#00C59E]/5 blur-[50px] rounded-full group-hover:bg-[#00C59E]/10 transition-all" />
                
                <div className="relative z-10 text-left">
                  <div className="w-14 h-14 rounded-2xl bg-[#00C59E]/5 flex items-center justify-center mb-8 border border-[#00C59E]/10 group-hover:scale-110 group-hover:bg-[#00C59E]/10 transition-all duration-500">
                    <Icon className="w-6 h-6 text-[#00C59E]" />
                  </div>
                  <h3 className="text-2xl font-black mb-4 text-white tracking-tight leading-none">{d.title}</h3>
                  <p className="text-white/40 leading-relaxed font-medium text-base">{d.desc}</p>
                </div>

                {/* Subtle top light line */}
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
