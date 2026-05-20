import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { NicheData } from "../data/niches";

const WA_LINK = "https://wa.me/5521993001883";

interface NicheHeroProps {
  niche: NicheData;
  onSignupClick: () => void;
}

const NicheHero = ({ niche, onSignupClick }: NicheHeroProps) => {
  const Icon = niche.icon;

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br ${niche.gradient} opacity-[0.07] blur-[120px]`}
        />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-[10px] font-bold tracking-[0.2em] uppercase enterprise-border rounded-full bg-primary/5 text-primary/80">
            <Icon className="w-3.5 h-3.5" />
            {niche.hero.eyebrow}
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[1.05] mb-6 text-balance">
            {niche.hero.title}{" "}
            <span className="text-gradient-primary">{niche.hero.titleHighlight}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground/80 max-w-2xl mx-auto mb-10 leading-relaxed text-pretty">
            {niche.hero.subtitle}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSignupClick}
              className="h-12 px-8 bg-primary text-primary-foreground font-bold rounded-xl text-sm inline-flex items-center gap-2 hover:shadow-[var(--shadow-glow)] transition-all duration-300"
            >
              <Sparkles className="w-4 h-4" />
              Testar 7 dias grátis
            </motion.button>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 px-8 border border-border rounded-xl text-sm font-semibold inline-flex items-center gap-2 hover:bg-muted/10 transition-all duration-300 text-foreground"
            >
              Falar com especialista
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default NicheHero;
