import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Rocket,
  Zap,
  LayoutGrid,
  Smartphone,
  Layers
} from "lucide-react";

const steps = [
  {
    icon: LayoutGrid,
    title: "Escolha o plano base",
    desc: "Comece com Essencial, Profissional ou Escala conforme volume, equipe e maturidade da sua operação comercial."
  },
  {
    icon: Smartphone,
    title: "Ative os módulos da sua operação",
    desc: "Adicione agenda, propostas, cobrança, recovery, checkout, links de pagamento, promoções ou prospecção conforme o seu nicho."
  },
  {
    icon: Layers,
    title: "Conecte canais e rotina operacional",
    desc: "Integre WhatsApp, Instagram e os módulos que sustentam a sua operação para trabalhar com mais contexto e menos retrabalho."
  },
  {
    icon: Rocket,
    title: "A IA atende e o time assume quando precisar",
    desc: "Você escolhe entre automação, atendimento assistido ou handoff humano, mantendo histórico, operação e próximo passo no mesmo fluxo."
  },
];

const HowItWorks = () => {
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: true, margin: "-100px" });
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="como-funciona" ref={containerRef} className="px-6 py-[16vh] relative overflow-hidden font-inter">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(168_100%_36%/0.05)_0%,transparent_50%)]" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-left mb-24"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-[10px] font-black tracking-[0.3em] uppercase enterprise-border rounded-full bg-[#00C59E]/5 text-[#00C59E]">
            <Zap className="w-3 h-3" />
            Como funciona
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter mb-6 leading-[1.1]">
            Como a <span className="text-[#00C59E]">AtendeAI</span> <br />entra na sua operação
          </h2>
          <p className="text-lg md:text-xl text-white/40 font-medium max-w-2xl leading-relaxed">
            O produto nasce da combinação entre plano base, módulos por nicho e uma operação comercial que pode ser automatizada, assistida ou humana.
          </p>
        </motion.div>

        <div className="relative">
          <div className="absolute left-7 top-0 bottom-0 w-px bg-white/5 hidden md:block">
            <motion.div
              style={{ scaleY: pathLength, transformOrigin: "top" }}
              className="absolute inset-0 w-full bg-gradient-to-b from-[#00C59E] to-[#00C59E]/20"
            />
          </div>

          <div className="space-y-16 md:space-y-24">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex flex-col md:flex-row gap-8 md:gap-16 pl-16 md:pl-0"
                >
                  <div className="absolute left-0 md:relative md:left-0 z-20">
                    <div className="w-14 h-14 rounded-2xl bg-[#080c0d] border border-white/10 flex items-center justify-center group relative overflow-hidden group hover:border-[#00C59E]/40 transition-all duration-500">
                      <div className="absolute inset-0 bg-[#00C59E]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Icon className="w-7 h-7 text-[#00C59E]" />
                      <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#00C59E] shadow-[0_0_10px_#00C59E] opacity-50" />
                    </div>
                  </div>

                  <div className="flex-1 pt-2">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-[10px] font-black text-[#00C59E] tracking-[0.2em] uppercase">Etapa {String(i + 1).padStart(2, "0")}</span>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black mb-4 text-white tracking-tight">{s.title}</h3>
                    <p className="text-white/50 leading-relaxed font-medium text-base md:text-lg max-w-3xl">
                      {s.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
