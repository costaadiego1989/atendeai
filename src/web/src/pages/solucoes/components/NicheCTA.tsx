import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import type { NicheData } from "../data/niches";

const WA_LINK = "https://wa.me/5521993001883";

interface NicheCTAProps {
  niche: NicheData;
  onSignupClick: () => void;
}

const NicheCTA = ({ niche, onSignupClick }: NicheCTAProps) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-24 px-6 relative overflow-hidden">
      <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${niche.gradient} opacity-[0.04]`} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-3xl mx-auto text-center"
      >
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter mb-4 leading-tight">
          Pronto para transformar seu{" "}
          <span className="text-gradient-primary">atendimento</span>?
        </h2>
        <p className="text-lg text-muted-foreground/80 mb-10 max-w-xl mx-auto">
          Comece agora com 7 dias grátis. Sem cartão de crédito, sem compromisso.
          Configure em minutos e veja resultados no primeiro dia.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSignupClick}
            className="h-14 px-10 bg-primary text-primary-foreground font-bold rounded-xl text-base inline-flex items-center gap-2 hover:shadow-[var(--shadow-glow)] transition-all duration-300"
          >
            <Sparkles className="w-4 h-4" />
            Começar teste grátis
          </motion.button>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="h-14 px-10 border border-border rounded-xl text-base font-semibold inline-flex items-center gap-2 hover:bg-muted/10 transition-all duration-300 text-foreground"
          >
            Falar com especialista
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </motion.div>
    </section>
  );
};

export default NicheCTA;
