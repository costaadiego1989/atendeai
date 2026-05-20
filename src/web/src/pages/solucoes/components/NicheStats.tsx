import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { TrendingUp } from "lucide-react";
import type { NicheData } from "../data/niches";

interface NicheStatsProps {
  niche: NicheData;
}

const NicheStats = ({ niche }: NicheStatsProps) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-medium tracking-widest uppercase border rounded-full border-primary/20 bg-primary/5 text-primary">
            <TrendingUp className="w-3.5 h-3.5" />
            Resultados
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">
            Números que falam por si
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {niche.stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
              className="enterprise-card rounded-2xl p-8 text-center"
            >
              <p className={`text-4xl md:text-5xl font-black tracking-tighter bg-gradient-to-r ${niche.gradient} bg-clip-text text-transparent mb-2`}>
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground font-medium">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NicheStats;
