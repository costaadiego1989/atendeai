import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const SectionDivider = ({ flip = false }: { flip?: boolean }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });

  return (
    <motion.div
      ref={ref}
      initial={{ scaleX: 0, opacity: 0 }}
      animate={inView ? { scaleX: 1, opacity: 1 } : {}}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative h-px mx-auto max-w-6xl overflow-hidden"
    >
      <div
        className={`absolute inset-0 bg-gradient-to-r from-transparent ${
          flip ? "via-primary/20" : "via-border/40"
        } to-transparent`}
      />
      
      {/* Moving light effect */}
      <motion.div
        animate={{ 
          x: ["-100%", "200%"],
          opacity: [0, 1, 0]
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity, 
          ease: "easeInOut",
          repeatDelay: 2
        }}
        className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
    </motion.div>
  );
};

export default SectionDivider;
