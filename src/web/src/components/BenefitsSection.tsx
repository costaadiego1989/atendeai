import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import { CheckCircle2, Trophy, BrainCircuit, Timer, TrendingUp, Shield } from "lucide-react";

const benefits = [
  { text: "Centralize atendimento, CRM e operação em um só lugar", icon: Trophy },
  { text: "Venda, cobre, agende e acompanhe no mesmo fluxo", icon: BrainCircuit },
  { text: "Ative módulos conforme o seu nicho e a sua rotina", icon: TrendingUp },
  { text: "Combine IA, automação e atendimento humano", icon: Shield },
  { text: "Meça nova venda e receita recuperada com mais clareza", icon: Timer },
  { text: "Escalone sem depender de processos soltos entre equipes", icon: CheckCircle2 },
];

const BenefitsSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  return (
    <section id="beneficios" ref={ref} className="px-6 py-[16vh] relative overflow-hidden">
      <motion.div style={{ y: bgY }} className="absolute inset-0 -top-[20%] -bottom-[20%]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(168_100%_36%/0.05)_0%,transparent_60%)]" />
      </motion.div>

      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/4 blur-[120px]"
      />

      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-xs font-semibold tracking-widest uppercase enterprise-border rounded-full bg-primary/5 text-primary">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Benefícios
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter">
            Por que escolher a <span className="text-gradient-primary">AtendeAI</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="flex items-center gap-4 p-5 rounded-xl enterprise-card hover:border-primary/15 transition-all group"
                style={{ borderColor: "hsl(168 100% 36% / 0.06)" }}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center flex-shrink-0 group-hover:from-primary/25 group-hover:to-primary/10 transition-all">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-foreground font-medium text-sm">{b.text}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
