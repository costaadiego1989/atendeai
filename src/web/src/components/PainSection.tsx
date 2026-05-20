import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import { XCircle, TrendingDown, ArrowRight, Sparkles } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";

const WA_LINK = "https://wa.me/5521993001883";

const painPoints = [
  { text: "Clientes chamando no WhatsApp e você sem tempo pra responder", icon: XCircle },
  { text: "Mensagens esquecidas e oportunidades perdidas", icon: XCircle },
  { text: "Respostas demoradas que fazem o cliente desistir", icon: XCircle },
  { text: "Atendimento sem padrão, sem estratégia e sem conversão", icon: XCircle },
];

const PainSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  return (
    <section ref={ref} className="px-6 py-[16vh] relative overflow-hidden">
      <motion.div style={{ y: bgY }} className="absolute inset-0 -top-[20%] -bottom-[20%]">
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/4 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(0_84%_60%/0.06)_0%,transparent_60%)]" />
      </motion.div>

      <motion.div
        animate={{ y: [0, -30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 right-[10%] w-[350px] h-[350px] rounded-full bg-destructive/4 blur-[120px]"
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-xs font-semibold tracking-widest uppercase border rounded-full border-destructive/15 bg-destructive/5 text-destructive">
            <TrendingDown className="w-3.5 h-3.5" />
            Problema
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter mb-10">
            Você já passou por <span className="text-destructive">isso</span>?
          </h2>
        </motion.div>

        <div className="space-y-3 mb-10">
          {painPoints.map((point, i) => {
            const Icon = point.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -30 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ x: 8, transition: { duration: 0.2 } }}
                className="flex items-center gap-4 p-5 rounded-xl enterprise-card border-destructive/8 hover:border-destructive/15 transition-colors group"
                style={{ borderColor: 'hsl(0 84% 60% / 0.06)' }}
              >
                <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 group-hover:bg-destructive/15 transition-colors">
                  <Icon className="w-4.5 h-4.5 text-destructive" />
                </div>
                <span className="text-foreground/80 group-hover:text-foreground transition-colors">{point.text}</span>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg font-semibold text-foreground mb-8"
        >
          Enquanto isso, seu concorrente responde mais rápido… e fecha a venda.
        </motion.p>

        <motion.a
          href={WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-2.5 h-14 px-8 bg-primary text-primary-foreground font-bold rounded-xl shadow-[var(--shadow-glow)] transition-all duration-300 hover:shadow-[var(--shadow-glow-lg)] text-base"
        >
          <Sparkles className="w-5 h-5" />
          Isso está custando dinheiro pra você
          <ArrowRight className="w-4 h-4" />
        </motion.a>
      </div>
    </section>
  );
};

export default PainSection;
