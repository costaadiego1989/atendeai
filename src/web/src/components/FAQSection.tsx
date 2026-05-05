import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Preciso entender de tecnologia?",
    a: "Não. Nós fazemos tudo pra você. Você só precisa aprovar.",
  },
  {
    q: "Funciona para qualquer negócio?",
    a: "Funciona melhor para quem vende pelo WhatsApp e Instagram. Se seus clientes te procuram por mensagem, funciona pra você.",
  },
  {
    q: "Quanto tempo leva?",
    a: "Em poucos dias já está funcionando. A maioria dos clientes começa a ver resultados na primeira semana.",
  },
  {
    q: "E se eu não gostar?",
    a: "Se não fizer sentido pra você, você não continua. Sem compromisso, sem letra pequena.",
  },
];

const FAQSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" ref={ref} className="px-6 py-[16vh] relative overflow-hidden">
      {/* Subtle bg */}
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] right-[5%] w-[250px] h-[250px] rounded-full bg-primary/3 blur-[100px]"
      />

      <div className="relative z-10 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium tracking-widest uppercase border rounded-full border-primary/20 bg-primary/5 text-primary">
            <HelpCircle className="w-3.5 h-3.5" />
            FAQ
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter">
            Perguntas frequentes
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full text-left px-6 py-5 flex justify-between items-center gap-4 hover:bg-muted/5 transition-colors"
              >
                <span className="font-semibold text-foreground">{faq.q}</span>
                <motion.div
                  animate={{ rotate: open === i ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                </motion.div>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5">
                      <p className="text-muted-foreground leading-relaxed">{faq.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
