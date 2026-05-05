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
    title: "Ative seu Especialista", 
    desc: "Selecione o nicho do seu negócio. Nossas IAs já nascem pré-treinadas com o vocabulário, as dores e as regras específicas do seu setor comercial." 
  },
  { 
    icon: Smartphone, 
    title: "Conexão API Oficial", 
    desc: "Vincule seu número diretamente à API Cloud da Meta em segundos. Estabilidade total, sem riscos de bloqueio e pronta para escala enterprise." 
  },
  { 
    icon: Layers, 
    title: "Escala Modular LEGO", 
    desc: "Ative os módulos que o seu negócio precisa: Agendamento Online, Checkout Nativo ou Triagem Inteligente. Você monta sua máquina como quiser." 
  },
  { 
    icon: Rocket, 
    title: "Operação Autônoma 24/7", 
    desc: "Sua IA assume o campo. Ela qualifica leads, fecha vendas e recupera carrinhos abandonados de forma humanizada, sem nunca parar de trabalhar." 
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
      {/* Dynamic Background Flare */}
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
            Engenharia de Fluxo
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter mb-6 leading-[1.1]">
            Como o <span className="text-[#00C59E]">AtendeAí</span> <br/>escala seu lucro
          </h2>
          <p className="text-lg md:text-xl text-white/40 font-medium max-w-2xl leading-relaxed">
            Abandone automações frágeis. Implemente uma infraestrutura de IA robusta, modular e conectada oficialmente à Meta.
          </p>
        </motion.div>

        <div className="relative">
          {/* Vertical Timeline Track */}
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
                  {/* Step Icon / Circle */}
                  <div className="absolute left-0 md:relative md:left-0 z-20">
                    <div className="w-14 h-14 rounded-2xl bg-[#080c0d] border border-white/10 flex items-center justify-center group relative overflow-hidden group hover:border-[#00C59E]/40 transition-all duration-500">
                      <div className="absolute inset-0 bg-[#00C59E]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Icon className="w-7 h-7 text-[#00C59E]" />
                      
                      {/* Floating Indicator */}
                      <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#00C59E] shadow-[0_0_10px_#00C59E] opacity-50" />
                    </div>
                  </div>

                  <div className="flex-1 pt-2">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-[10px] font-black text-[#00C59E] tracking-[0.2em] uppercase">Módulo {String(i + 1).padStart(2, '0')}</span>
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
