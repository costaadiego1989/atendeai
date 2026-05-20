import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import { Zap, ClipboardList, Target, CalendarCheck, DollarSign, Smartphone, Sparkles } from "lucide-react";

const features = [
  { title: "Responde automaticamente", desc: "Seus clientes recebem resposta imediata, 24h por dia.", icon: Zap },
  { title: "Organiza conversas", desc: "Tudo centralizado, sem perder nenhuma mensagem importante.", icon: ClipboardList },
  { title: "Qualifica leads", desc: "Identifica quem está pronto para comprar e prioriza.", icon: Target },
  { title: "Agenda atendimentos", desc: "Marca horários automaticamente sem vai-e-vem.", icon: CalendarCheck },
  { title: "Conduz até a compra", desc: "Fluxos inteligentes que transformam conversa em venda.", icon: DollarSign },
  { title: "WhatsApp + Instagram", desc: "Multi-canal com uma única automação inteligente.", icon: Smartphone },
];

const SolutionSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);

  return (
    <section ref={ref} className="px-6 py-[16vh] relative overflow-hidden">
      <motion.div style={{ y: bgY }} className="absolute inset-0 -top-[20%] -bottom-[20%]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(168_100%_36%/0.06)_0%,transparent_60%)]" />
      </motion.div>

      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[conic-gradient(from_0deg,transparent,hsl(168_100%_36%/0.03),transparent,hsl(168_100%_36%/0.05),transparent)] blur-[40px]"
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-xs font-semibold tracking-widest uppercase enterprise-border rounded-full bg-primary/5 text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            Solução
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter mb-4">
            Um sistema que <span className="text-gradient-primary">vende por você</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl leading-relaxed">
            Tudo funcionando 24 horas por dia, sem você precisar ficar no celular.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="group relative p-6 rounded-2xl enterprise-card overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4 group-hover:from-primary/25 group-hover:to-primary/10 transition-all">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
