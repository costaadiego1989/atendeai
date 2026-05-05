import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Sparkles, BarChart3, Shield, Zap, Bot } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";

const WA_LINK = "https://wa.me/5521993001883";

const conversation = [
  { from: "client-typing", text: "" },
  { from: "client", text: "Olá! Gostaria de agendar com o Dr. Rafael Veiga." },
  { from: "typing", text: "" },
  { from: "bot", text: "Olá! 😊 Sou a assistente do Dr. Rafael. Temos vagas para esta semana. Qual o melhor dia para você?" },
  { from: "client-typing", text: "" },
  { from: "client", text: "Teria horário na Quinta-feira?" },
  { from: "typing", text: "" },
  { from: "bot", text: "Tenho sim! Na Quinta temos 10:00, 14:30 e 16:00. Algum desses te atende?" },
  { from: "client-typing", text: "" },
  { from: "client", text: "14:30 fica perfeito!" },
  { from: "typing", text: "" },
  { from: "bot", text: "Ótimo! Para finalizar sua reserva, gerei seu link de checkout seguro abaixo:" },
  { from: "bot", text: "🔗 pay.atendeai.io/v/dr-rafael" },
  { from: "typing", text: "" },
  { from: "bot", text: "✅ Pix confirmado! Tudo certo para Quinta às 14:30 com o Dr. Rafael Veiga. Te esperamos! 👋" },
];

const TypingIndicator = ({ isClient = false }: { isClient?: boolean }) => (
  <div className="flex gap-1.5 px-4 py-3">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className={`w-2 h-2 rounded-full ${isClient ? "bg-primary-foreground/60" : "bg-muted-foreground/40"}`}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
      />
    ))}
  </div>
);

const stats = [
  { value: "24/7", label: "Disponível", icon: Zap },
  { value: "<3s", label: "Tempo resposta", icon: BarChart3 },
  { value: "100%", label: "Automatizado", icon: Shield },
];

const Hero = () => {
  const [visibleMessages, setVisibleMessages] = useState<typeof conversation>([]);
  const [msgIndex, setMsgIndex] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);

  useEffect(() => {
    if (msgIndex >= conversation.length) {
      const timeout = setTimeout(() => {
        setVisibleMessages([]);
        setMsgIndex(0);
      }, 4000);
      return () => clearTimeout(timeout);
    }

    const msg = conversation[msgIndex];
    const isTyping = msg.from === "typing" || msg.from === "client-typing";
    const delay = msgIndex === 0 ? 1000 : isTyping ? 600 : 400;

    const timeout = setTimeout(() => {
      if (isTyping) {
        setVisibleMessages((prev) => [...prev, msg]);
        setTimeout(() => {
          setVisibleMessages((prev) => prev.filter((m) => m.from !== "typing" && m.from !== "client-typing"));
          setMsgIndex((i) => i + 1);
        }, 1200);
      } else {
        setVisibleMessages((prev) => [
          ...prev.filter((m) => m.from !== "typing" && m.from !== "client-typing"),
          msg,
        ]);
        setMsgIndex((i) => i + 1);
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [msgIndex]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [visibleMessages]);

  return (
    <section ref={sectionRef} className="relative min-h-svh flex flex-col items-center justify-center px-6 pt-24 pb-[15vh] overflow-hidden">
      <motion.div style={{ y: bgY }} className="absolute inset-0 -top-[15%] -bottom-[15%] pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,hsl(168_100%_36%/0.22),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_85%_90%,hsl(168_100%_40%/0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_15%_60%,hsl(180_70%_30%/0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(168_100%_36%/0.03),transparent_100%)]" />
      </motion.div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[120%] -z-1 overflow-hidden pointer-events-none opacity-40">
        <motion.div
          animate={{
            rotate: [0, 360],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,hsl(168_100%_36%/0.08)_60deg,transparent_120deg,hsl(180_80%_45%/0.06)_180deg,transparent_240deg,hsl(168_100%_36%/0.08)_300deg,transparent_360deg)] blur-[120px]"
        />
      </div>

      {/* Abstract floating shapes for texture */}
      <motion.div
        className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[160px]"
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -60, 100, 0],
          scale: [1, 1.2, 0.9, 1]
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/3 blur-[140px]"
        animate={{
          x: [0, -80, 60, 0],
          y: [0, 50, -100, 0],
          scale: [1, 0.8, 1.1, 1]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(hsl(168 100% 36%) 1px, transparent 1px), linear-gradient(90deg, hsl(168 100% 36%) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />

      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
      }} />

      <motion.div style={{ y: contentY }} className="relative z-10 max-w-6xl w-full flex flex-col lg:flex-row items-center gap-16">
        {/* Left content */}
        <div className="flex-1 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-xs font-semibold tracking-widest uppercase enterprise-border rounded-full bg-primary/5 text-primary"
          >
            <Bot className="w-3.5 h-3.5 text-[#00C59E] drop-shadow-[0_0_8px_rgba(0,197,158,0.8)]" />
            Máquina de vendas inteligente
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter mb-6 leading-[0.95]"
          >
            A inteligência comercial que <span className="text-gradient-primary">vende por você</span> no WhatsApp
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 text-pretty leading-relaxed"
          >
            Um cérebro operacional que conhece seu estoque, agenda e catálogo. Automatize o atendimento, qualifique leads, recupere vendas e ou automatize seu checkout com IA.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-center gap-4 mb-10"
          >
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 h-14 px-8 bg-primary text-primary-foreground font-bold rounded-xl shadow-[var(--shadow-glow)] transition-all duration-300 hover:shadow-[var(--shadow-glow-lg)] hover:scale-[1.02] active:scale-[0.98] text-base"
            >
              <Sparkles className="w-5 h-5" />
              Ganhe 7 dias grátis
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <WhatsAppIcon className="w-4 h-4 text-primary" />
              Ver como funciona
            </a>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-6 justify-center lg:justify-start"
          >
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-lg font-bold text-foreground tabular-nums">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* Right: Chat simulation */}
        <motion.div
          initial={{ opacity: 0, x: 30, rotateY: -5 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex-shrink-0 w-full max-w-sm"
        >
          <div className="enterprise-card rounded-2xl p-4 shadow-[var(--shadow-glow-lg)]">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-primary/8">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary font-bold text-sm">AI</div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-foreground">AtendeAI Bot</p>
                <p className="text-xs text-primary flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Online
                </p>
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary/20" />
                <div className="w-2 h-2 rounded-full bg-primary/20" />
                <div className="w-2 h-2 rounded-full bg-primary/20" />
              </div>
            </div>
            <div
              ref={chatRef}
              className="space-y-2 min-h-[300px] max-h-[340px] overflow-hidden flex flex-col justify-end"
            >
              <AnimatePresence mode="popLayout">
                {visibleMessages.map((msg, i) => {
                  const isClientTyping = msg.from === "client-typing";
                  const isBotTyping = msg.from === "typing";
                  const isClient = msg.from === "client" || isClientTyping;

                  return (
                    <motion.div
                      key={`${i}-${msg.text}-${msg.from}`}
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                      layout
                      className={`flex ${isClient ? "justify-end" : "justify-start"}`}
                    >
                      {(isBotTyping || isClientTyping) ? (
                        <div className={`rounded-2xl ${isClientTyping
                          ? "bg-primary rounded-br-md"
                          : "bg-secondary rounded-bl-md"
                          }`}>
                          <TypingIndicator isClient={isClientTyping} />
                        </div>
                      ) : (
                        <div
                          className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.from === "client"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-secondary text-secondary-foreground rounded-bl-md"
                            }`}
                        >
                          {msg.text}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
