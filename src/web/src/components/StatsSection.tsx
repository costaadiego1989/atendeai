import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { MessageSquare, Puzzle, Calendar, CreditCard } from "lucide-react";

const stats = [
  { value: "Atendimento", label: "WhatsApp e Instagram no mesmo fluxo", icon: MessageSquare },
  { value: "Módulos", label: "Ative agenda, cobrança, checkout, propostas e mais", icon: Puzzle },
  { value: "Agenda", label: "Profissionais, horários, confirmações e no-show", icon: Calendar },
  { value: "Pagamento", label: "Links, proposta, checkout e recuperação", icon: CreditCard },
];

const StatsSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section ref={ref} className="px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/3 to-primary/5" />
      <motion.div
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-primary/5 to-transparent"
      />

      <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
                {s.value}
              </p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.label}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default StatsSection;
