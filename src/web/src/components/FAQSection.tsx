import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Como funcionam os planos base?",
    a: "A operação começa com um plano base mensal: Essencial, Profissional ou Escala. Eles definem a capacidade inicial de WhatsApp, contatos, IA e operação.",
  },
  {
    q: "O que são módulos extras?",
    a: "São recursos ativados conforme a necessidade da operação, como agenda, checkout conversacional, propostas, links de pagamento, cobrança, recovery, promoções ou prospecção.",
  },
  {
    q: "Serve para quais nichos?",
    a: "Hoje a plataforma atende especialmente varejo, e-commerce, food & delivery, saúde & agenda, beleza, pet, cobrança & recovery, serviços consultivos e empresas B2B.",
  },
  {
    q: "Funciona com WhatsApp e Instagram?",
    a: "Sim. A plataforma foi pensada para operar atendimento comercial por mensagem, com centralização do fluxo e contexto da operação.",
  },
  {
    q: "Como funciona o trial de 7 dias?",
    a: "Você ativa a conta, testa a base da plataforma e valida a operação com 7 dias de trial antes de seguir com a contratação.",
  },
  {
    q: "Quando faz sentido usar agenda, checkout, cobrança, propostas ou prospecção?",
    a: "Cada módulo entra quando faz parte da sua rotina comercial. A ideia é ativar só o que sustenta o seu fluxo atual, sem contratar uma operação maior do que você precisa.",
  },
  {
    q: "O time humano pode assumir a conversa?",
    a: "Sim. A plataforma suporta handoff humano e operação assistida, então a IA pode automatizar, sugerir respostas ou transferir a conversa para a equipe.",
  },
];

const FAQSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" ref={ref} className="px-6 py-[16vh] relative overflow-hidden">
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
              className="relative rounded-xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden"
            >
              {/* Border light sweep */}
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 + i * 0.6 }}
                className="absolute top-0 left-0 w-1/4 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
              />
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
