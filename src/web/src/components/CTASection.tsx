import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Sparkles, Rocket } from "lucide-react";

interface CTASectionProps {
  onSignupClick: () => void;
}

const CTASection: React.FC<CTASectionProps> = ({ onSignupClick }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="px-6 py-[16vh] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,hsl(168_100%_36%/0.08),transparent_70%)]" />

      <div className="relative z-10 max-w-6xl mx-auto text-left">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-xs font-semibold tracking-widest uppercase enterprise-border rounded-full bg-primary/5 text-primary"
        >
          <Rocket className="w-3.5 h-3.5" />
          Comece agora
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter mb-6 leading-[0.95]"
        >
          Monte sua <span className="text-gradient-primary">operação comercial com IA</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed"
        >
          Comece pelo plano base, ative os módulos do seu nicho e valide atendimento, agenda, cobrança, propostas e pagamento com 7 dias grátis.
        </motion.p>

        <motion.button
          onClick={() => onSignupClick()}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-2.5 h-14 px-10 bg-primary text-primary-foreground font-bold rounded-xl shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-glow-lg)] transition-all duration-300 text-base"
        >
          <Sparkles className="w-5 h-5" />
          Começar trial
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-5 text-xs text-muted-foreground/60"
        >
          7 dias grátis. Não requer cartão de crédito.
        </motion.p>
      </div>
    </section>
  );
};

export default CTASection;
