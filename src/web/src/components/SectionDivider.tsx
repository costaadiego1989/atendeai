import { motion } from "framer-motion";

const SectionDivider = ({ flip = false }: { flip?: boolean }) => {
  return (
    <div className="relative h-px mx-auto max-w-5xl overflow-hidden">
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
    </div>
  );
};

export default SectionDivider;
