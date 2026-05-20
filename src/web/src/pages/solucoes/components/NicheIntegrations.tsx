import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link2 } from "lucide-react";
import type { NicheData } from "../data/niches";

interface NicheIntegrationsProps {
  niche: NicheData;
}

const NicheIntegrations = ({ niche }: NicheIntegrationsProps) => {
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
            <Link2 className="w-3.5 h-3.5" />
            Integrações
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">
            Conecta com o que você já usa
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          {niche.integrations.map((integration, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.15 * i }}
              className="enterprise-card rounded-xl px-5 py-3 text-sm font-medium text-foreground/80"
            >
              {integration}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default NicheIntegrations;
