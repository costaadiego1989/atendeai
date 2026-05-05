import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { TrendingUp, Clock, Users, Zap } from "lucide-react";

const stats = [
  { value: 97, suffix: "%", label: "Taxa de resposta", icon: TrendingUp },
  { value: 3, suffix: "s", label: "Tempo médio resposta", icon: Clock },
  { value: 500, suffix: "+", label: "Empresas atendidas", icon: Users },
  { value: 24, suffix: "/7", label: "Operação contínua", icon: Zap },
];

const AnimatedCounter = ({ target, suffix, inView }: { target: number; suffix: string; inView: boolean }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span className="tabular-nums">{count}{suffix}</span>;
};

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

      <div className="relative z-10 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
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
              <p className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                <AnimatedCounter target={s.value} suffix={s.suffix} inView={inView} />
              </p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default StatsSection;
