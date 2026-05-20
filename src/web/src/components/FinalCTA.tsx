import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, CalendarCheck, Sparkles, Rocket, CheckCircle2 } from "lucide-react";

const MEETING_LINK = "https://wa.me/5521993001883?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20reuni%C3%A3o%20para%20conhecer%20o%20AtendeAI";

const benefits = [
  "Setup guiado em 15 minutos",
  "Sem cartão na largada",
  "Suporte humano no WhatsApp",
  "Cancele quando quiser",
];

interface FinalCTAProps {
  onSignupClick: () => void;
}

const FinalCTA: React.FC<FinalCTAProps> = ({ onSignupClick }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="px-6 py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,hsl(168_100%_36%/0.06),transparent_70%)]" />

      <div className="relative z-10 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl enterprise-card p-10 md:p-14 text-left overflow-hidden"
        >
          {/* Border light sweep effects */}
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
            className="absolute top-0 left-0 w-1/3 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          />
          <motion.div
            animate={{ x: ["200%", "-100%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
            className="absolute bottom-0 left-0 w-1/3 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
          />
          <motion.div
            animate={{ y: ["-100%", "200%"] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
            className="absolute top-0 right-0 w-px h-1/3 bg-gradient-to-b from-transparent via-primary/50 to-transparent"
          />
          <motion.div
            animate={{ y: ["200%", "-100%"] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", repeatDelay: 3.5 }}
            className="absolute top-0 left-0 w-px h-1/3 bg-gradient-to-b from-transparent via-primary/40 to-transparent"
          />

          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-xs font-semibold tracking-widest uppercase enterprise-border rounded-full bg-primary/5 text-primary">
            <Rocket className="w-3.5 h-3.5" />
            Pronto para começar?
          </div>

          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter mb-4 leading-[0.95]">
            Transforme seu atendimento em{" "}
            <span className="text-gradient-primary">máquina de vendas</span>
          </h2>

          <p className="text-lg text-muted-foreground max-w-2xl mb-8">
            Agende uma reunião com nosso time ou comece agora com 7 dias grátis.
            Sem compromisso, sem cartão.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
            <motion.a
              href={MEETING_LINK}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2.5 h-14 px-8 border-2 border-primary text-primary font-bold rounded-xl hover:bg-primary/5 transition-all duration-300 text-base"
            >
              <CalendarCheck className="w-5 h-5" />
              Agendar reunião
              <ArrowRight className="w-4 h-4" />
            </motion.a>

            <motion.button
              onClick={onSignupClick}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2.5 h-14 px-8 bg-primary text-primary-foreground font-bold rounded-xl shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-glow-lg)] transition-all duration-300 text-base"
            >
              <Sparkles className="w-5 h-5" />
              Começar 7 dias grátis
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">{benefit}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTA;
