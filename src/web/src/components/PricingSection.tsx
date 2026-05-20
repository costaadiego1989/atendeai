import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Crown,
  Globe,
  Puzzle,
  Package,
  BarChart3,
  Clock,
  Briefcase,
  Gift,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { publicService, NicheAPI } from "@/services/PublicService";
import { cn } from "@/lib/utils";

interface PricingSectionProps {
  onSignupClick: (planName: string) => void;
  hideHeader?: boolean;
}

interface VolumeOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  recommendation: string;
}

const PAIN_COPY_MAP: Record<string, { label: string; description: string }> = {
  responder_rapido: {
    label: "Responder rápido",
    description: "A operação precisa ganhar velocidade sem perder contexto ou qualidade no atendimento.",
  },
  mostrar_disponibilidade: {
    label: "Mostrar disponibilidade",
    description: "Produtos, horários ou capacidade precisam aparecer com mais clareza durante a conversa.",
  },
  recuperar_oportunidade: {
    label: "Recuperar oportunidade",
    description: "Pedidos, propostas ou contatos esfriam antes do fechamento e exigem retomada organizada.",
  },
  converter_carrinho: {
    label: "Converter carrinho",
    description: "A venda trava entre catálogo, pagamento e confirmação do pedido.",
  },
  reduzir_abandono: {
    label: "Reduzir abandono",
    description: "O cliente demonstra intenção, mas sai sem concluir a jornada comercial.",
  },
  organizar_pedidos: {
    label: "Organizar pedidos",
    description: "A operação precisa ligar atendimento, checkout, entrega e status em um mesmo fluxo.",
  },
  preencher_agenda: {
    label: "Preencher agenda",
    description: "O time precisa ocupar melhor horários e responder disponibilidade com mais rapidez.",
  },
  reduzir_faltas: {
    label: "Reduzir faltas",
    description: "Lembretes, confirmações e pagamento antecipado podem proteger a agenda.",
  },
  confirmar_atendimento: {
    label: "Confirmar atendimento",
    description: "A jornada de reserva ainda depende demais de processos manuais.",
  },
  reduzir_no_show: {
    label: "Reduzir no-show",
    description: "Profissionais e horários perdem valor quando a confirmação não acontece no tempo certo.",
  },
  organizar_profissionais: {
    label: "Organizar profissionais",
    description: "A disponibilidade precisa considerar categoria, agenda e regras de operação.",
  },
  vender_recorrencia: {
    label: "Vender recorrência",
    description: "É preciso acompanhar retorno comercial e próximos atendimentos com mais consistência.",
  },
  priorizar_carteira: {
    label: "Priorizar carteira",
    description: "A cobrança precisa focar quem tem maior potencial de recuperação.",
  },
  controlar_promessas: {
    label: "Controlar promessas",
    description: "A operação precisa registrar compromissos de pagamento e próximos toques.",
  },
  medir_recuperacao: {
    label: "Medir recuperação",
    description: "É importante separar receita recuperada de nova venda e acompanhar o impacto real.",
  },
  qualificar_demanda: {
    label: "Qualificar demanda",
    description: "Leads chegam, mas o time ainda perde tempo filtrando o que faz sentido atender.",
  },
  gerar_orcamento: {
    label: "Gerar orçamento",
    description: "Propostas e respostas comerciais precisam sair mais rápido e com menos retrabalho.",
  },
  acompanhar_retorno: {
    label: "Acompanhar retorno",
    description: "O comercial precisa saber quem voltou, quem esfriou e qual é o próximo passo.",
  },
  gerar_propostas_rapidas: {
    label: "Gerar propostas rápidas",
    description: "A equipe precisa responder propostas e orçamentos sem depender de processos dispersos.",
  },
  acompanhar_aprovacao: {
    label: "Acompanhar aprovação",
    description: "Aceite, pagamento e confirmação comercial precisam ficar mais visíveis para a operação.",
  },
  organizar_pipeline_b2b: {
    label: "Organizar pipeline B2B",
    description: "O ciclo mais longo pede histórico, próximos passos e mais disciplina operacional.",
  },
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  ESSENCIAL: Zap,
  PROFISSIONAL: Crown,
  ESCALA: Globe,
};

const VOLUME_OPTIONS: VolumeOption[] = [
  { id: "low", label: "Operação inicial", description: "Validação com WhatsApp, CRM, IA e automações básicas", icon: Zap, recommendation: "ESSENCIAL" },
  { id: "mid", label: "Rotina comercial ativa", description: "Rotina com agenda, checkout, propostas e cobrança ativa", icon: Crown, recommendation: "PROFISSIONAL" },
  { id: "high", label: "Escala operacional", description: "Multi-time com voz, prospecção, recovery e governança", icon: Globe, recommendation: "ESCALA" },
];

function calculateRecommendation(
  selectedPainsCount: number,
  volumeId: string,
  totalPainsAvailable: number,
): string {
  const volume = VOLUME_OPTIONS.find((v) => v.id === volumeId);
  const baseRecommendation = volume?.recommendation || "PROFISSIONAL";
  const painRatio = totalPainsAvailable > 0 ? selectedPainsCount / totalPainsAvailable : 0;

  if (baseRecommendation === "ESSENCIAL" && painRatio > 0.6) {
    return "PROFISSIONAL";
  }
  if (baseRecommendation === "PROFISSIONAL" && painRatio > 0.7) {
    return "ESCALA";
  }

  return baseRecommendation;
}

function humanizePain(rawPain: string): { label: string; description: string } {
  const key = rawPain.trim().toLowerCase();
  const mapped = PAIN_COPY_MAP[key];
  if (mapped) return mapped;

  const normalized = key.replace(/[_-]+/g, " ").trim();
  const label =
    normalized.length > 0
      ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
      : rawPain;

  return {
    label,
    description: "Ponto operacional que impacta conversão, velocidade ou qualidade do atendimento.",
  };
}

const ProgressBar = ({ current, total }: { current: number; total: number }) => (
  <div className="flex items-center gap-3 mb-10">
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
          initial={{ width: "0%" }}
          animate={{ width: i < current ? "100%" : i === current ? "50%" : "0%" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    ))}
    <span className="text-xs text-white/30 font-bold tabular-nums min-w-[3ch]">{current + 1}/{total}</span>
  </div>
);

const StepHeader = ({ step, title, subtitle }: { step: number; title: string; subtitle: string }) => (
  <div className="mb-10">
    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 mb-4">
      <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px]">{step}</span>
      Etapa {step}
    </span>
    <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight mb-2">{title}</h3>
    <p className="text-white/40 text-sm leading-relaxed">{subtitle}</p>
  </div>
);

const ANALYZING_TEXTS = [
  "Cruzando nicho e momento operacional...",
  "Avaliando módulos mais aderentes...",
  "Montando recomendação personalizada...",
];

const AnalyzingSubtext = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % ANALYZING_TEXTS.length);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={index}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="text-sm text-white/40 text-center max-w-sm"
      >
        {ANALYZING_TEXTS[index]}
      </motion.p>
    </AnimatePresence>
  );
};

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    filter: "blur(4px)",
  }),
  center: { x: 0, opacity: 1, filter: "blur(0px)" },
  exit: (direction: number) => ({
    x: direction < 0 ? 80 : -80,
    opacity: 0,
    filter: "blur(4px)",
  }),
};

const PricingSection: React.FC<PricingSectionProps> = ({ onSignupClick, hideHeader = false }) => {
  const ref = useRef(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedNiche, setSelectedNiche] = useState<NicheAPI | null>(null);
  const [selectedPains, setSelectedPains] = useState<string[]>([]);
  const [volume, setVolume] = useState("");
  const [recommendedPlan, setRecommendedPlan] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => publicService.getPlans(),
  });

  const { data: nichesData, isLoading: loadingNiches } = useQuery({
    queryKey: ["public-niches"],
    queryFn: () => publicService.getNiches(),
  });

  const { data: modulesData } = useQuery({
    queryKey: ["public-modules"],
    queryFn: () => publicService.getModules(),
  });

  const isLoading = loadingPlans || loadingNiches;

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => s + 1);
  }, []);

  const goBack = useCallback(() => {
    if (step === 0) return;
    setDirection(-1);
    setStep((s) => s - 1);
  }, [step]);

  const reset = useCallback(() => {
    setDirection(-1);
    setStep(0);
    setSelectedNiche(null);
    setSelectedPains([]);
    setVolume("");
    setRecommendedPlan("");
    setAnalyzing(false);
    setShowAllPlans(false);
  }, []);

  const selectNiche = (niche: NicheAPI) => {
    setSelectedNiche(niche);
    setSelectedPains([]);
    setTimeout(goNext, 300);
  };

  const togglePain = (pain: string) => {
    setSelectedPains((prev) =>
      prev.includes(pain) ? prev.filter((p) => p !== pain) : [...prev, pain]
    );
  };

  const selectVolume = (id: string) => {
    setVolume(id);
    setDirection(1);
    setStep(3);
    setAnalyzing(true);
  };

  useEffect(() => {
    if (!analyzing) return;
    const timer = setTimeout(() => {
      const totalPains = selectedNiche?.pains?.length || 1;
      const result = calculateRecommendation(selectedPains.length, volume, totalPains);
      setRecommendedPlan(result);
      setAnalyzing(false);
      setDirection(1);
      setStep(4);
    }, 1800);
    return () => clearTimeout(timer);
  }, [analyzing, selectedNiche, selectedPains, volume]);

  const nicheModules = useMemo(() => {
    if (!selectedNiche?.modules || !modulesData?.modules) return [];
    return modulesData.modules.filter((m) =>
      selectedNiche.modules.includes(m.code)
    );
  }, [selectedNiche, modulesData]);

  const visiblePlans = useMemo(() => {
    return plansData?.plans ?? [];
  }, [plansData]);

  const recommendedPlanData = visiblePlans.find((p) => p.code === recommendedPlan);
  const RecommendedIcon = PLAN_ICONS[recommendedPlan] || Sparkles;
  const painIcons = [Clock, Package, Briefcase, Crown, BarChart3];
  const TOTAL_STEPS = 5;

  const PROMO_DISCOUNT_MONTHLY = Number(import.meta.env.VITE_PROMO_DISCOUNT_MONTHLY) || 20;
  const PROMO_DISCOUNT_ANNUAL = Number(import.meta.env.VITE_PROMO_DISCOUNT_ANNUAL) || 40;
  const currentDiscount = billingCycle === "YEARLY" ? PROMO_DISCOUNT_ANNUAL : PROMO_DISCOUNT_MONTHLY;
  const discountedPrice = (price: number) => Math.round(price * (1 - currentDiscount / 100));
  const annualTotal = (price: number) => discountedPrice(price) * 12;
  const annualSavings = (price: number) => (price * 12) - annualTotal(price);

  return (
    <section
      id="planos"
      ref={ref}
      className={cn(
        "relative overflow-hidden",
        !hideHeader && "px-6 py-24 lg:py-32 bg-background",
        hideHeader && "py-0 lg:py-0"
      )}
    >
      <div className="absolute inset-0 pointer-events-none -z-1">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/8 blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {!hideHeader && (
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] uppercase tracking-widest font-bold mb-6"
            >
              <Sparkles className="w-3 h-3" />
              Planos e módulos
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70 leading-tight"
            >
              Planos base para operar. <span className="text-primary">Módulos para crescer.</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              Você começa com um plano mensal e ativa apenas os módulos que fazem sentido para a sua operação.
            </motion.p>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="relative flex items-center p-1 rounded-full bg-white/[0.06] border border-white/10">
              <button
                onClick={() => setBillingCycle("MONTHLY")}
                className={cn(
                  "relative z-10 px-5 py-2 rounded-full text-xs font-black transition-colors duration-200",
                  billingCycle === "MONTHLY" ? "text-black" : "text-white/50 hover:text-white/70"
                )}
              >
                Mensal
              </button>
              <button
                onClick={() => setBillingCycle("YEARLY")}
                className={cn(
                  "relative z-10 px-5 py-2 rounded-full text-xs font-black transition-colors duration-200",
                  billingCycle === "YEARLY" ? "text-black" : "text-white/50 hover:text-white/70"
                )}
              >
                Anual
              </button>
              <motion.div
                className="absolute top-1 bottom-1 rounded-full bg-primary"
                animate={{ left: billingCycle === "MONTHLY" ? "4px" : "50%", right: billingCycle === "YEARLY" ? "4px" : "50%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              Promoção de lançamento — {currentDiscount}% off
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="relative">
            <ProgressBar current={step} total={TOTAL_STEPS} />

            <AnimatePresence>
              {step > 0 && step < 4 && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={goBack}
                  className="absolute -top-1 right-0 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors font-bold z-20"
                >
                  <ArrowLeft className="w-3 h-3" /> Voltar
                </motion.button>
              )}
            </AnimatePresence>

            <div className="relative min-h-[420px]">
              <AnimatePresence mode="wait" custom={direction}>
                {step === 0 && (
                  <motion.div
                    key="step-0"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                  >
                    <StepHeader
                      step={1}
                      title="Qual é o perfil da sua operação?"
                      subtitle="Selecione o nicho mais próximo do seu negócio para montar uma recomendação de plano base e módulos."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {nichesData?.niches?.map((niche) => {
                        const isSelected = selectedNiche?.code === niche.code;
                        return (
                          <motion.button
                            key={niche.code}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => selectNiche(niche)}
                            className={cn(
                              "group relative p-6 rounded-2xl border text-left transition-all duration-300 overflow-hidden",
                              isSelected
                                ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                                : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                            )}
                          >
                            <h4 className="text-sm font-black text-white mb-1">{niche.displayName}</h4>
                            <p className="text-xs text-white/35 leading-relaxed line-clamp-2">{niche.description}</p>
                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full border border-white/10 flex items-center justify-center">
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-3 h-3 rounded-full bg-primary"
                                />
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {step === 1 && selectedNiche && (
                  <motion.div
                    key="step-1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                  >
                    <StepHeader
                      step={2}
                      title="O que mais pesa hoje na rotina?"
                      subtitle={`Em ${selectedNiche.displayName}, selecione os pontos que já fazem parte da sua operação.`}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedNiche.pains?.map((pain, idx) => {
                        const selected = selectedPains.includes(pain);
                        const PainIcon = painIcons[idx % painIcons.length];
                        const painCopy = humanizePain(pain);
                        return (
                          <motion.button
                            key={pain}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => togglePain(pain)}
                            className={cn(
                              "group flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200 min-h-[132px]",
                              selected
                                ? "border-primary/50 bg-primary/10"
                                : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                            )}
                          >
                            <div className={cn(
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                              selected
                                ? "bg-primary border-primary"
                                : "border-white/20 group-hover:border-white/30"
                            )}>
                              {selected && <CheckCircle2 className="w-3 h-3 text-black" />}
                            </div>
                            <PainIcon className={cn("w-4 h-4 shrink-0", selected ? "text-primary" : "text-white/30")} />
                            <div className="space-y-1">
                              <span
                                className={cn(
                                  "block text-sm font-semibold leading-snug",
                                  selected ? "text-white" : "text-white/70"
                                )}
                              >
                                {painCopy.label}
                              </span>
                              <span className="block text-xs leading-relaxed text-white/35">
                                {painCopy.description}
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={goNext}
                      disabled={selectedPains.length === 0}
                      className={cn(
                        "mt-8 w-full h-14 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all",
                        selectedPains.length > 0
                          ? "bg-primary text-black shadow-lg shadow-primary/20 hover:shadow-primary/30"
                          : "bg-white/5 text-white/20 cursor-not-allowed"
                      )}
                    >
                      Continuar
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step-2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                  >
                    <StepHeader
                      step={3}
                      title="Em que estágio a sua operação está?"
                      subtitle="Isso ajuda a indicar a base mensal mais adequada antes dos módulos extras."
                    />
                    <div className="space-y-4">
                      {VOLUME_OPTIONS.map((vol) => (
                        <motion.button
                          key={vol.id}
                          whileHover={{ scale: 1.01, x: 4 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => selectVolume(vol.id)}
                          className={cn(
                            "group flex items-center gap-5 w-full p-6 rounded-2xl border text-left transition-all duration-300",
                            volume === vol.id
                              ? "border-primary/50 bg-primary/10"
                              : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
                          )}
                        >
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                            volume === vol.id
                              ? "bg-primary text-black"
                              : "bg-white/8 text-white/40 group-hover:text-white/60"
                          )}>
                            <vol.icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-black text-white mb-0.5">{vol.label}</h4>
                            <p className="text-xs text-white/35">{vol.description}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-white/15 group-hover:text-white/30 transition-colors" />
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step-3"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                    className="flex flex-col items-center justify-center py-20"
                  >
                    <div className="flex items-center gap-2 mb-10">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-3 h-3 rounded-full bg-gradient-to-br from-primary to-primary/60"
                          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                        />
                      ))}
                    </div>
                    <h3 className="text-xl font-black text-white mb-3">Analisando sua operação...</h3>
                    <AnalyzingSubtext />
                  </motion.div>
                )}

                {step === 4 && recommendedPlanData && (
                  <motion.div
                    key="step-4"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                  >
                    <div className="text-center mb-8">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-black uppercase tracking-widest mb-4"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Recomendação para {selectedNiche?.displayName}
                      </motion.div>
                    </div>

                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="relative p-8 md:p-10 rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden"
                    >
                      <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/15 blur-[80px] rounded-full pointer-events-none" />
                      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />

                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-8">
                          <div>
                            <div className="w-14 h-14 rounded-2xl bg-primary text-black flex items-center justify-center mb-5 shadow-lg shadow-primary/25">
                              <RecommendedIcon className="w-7 h-7" />
                            </div>
                            <h3 className="text-3xl font-black text-white mb-1">{recommendedPlanData.displayName}</h3>
                            <p className="text-sm text-white/40">{recommendedPlanData.description}</p>
                          </div>
                          <div className="text-right">
                            <span className="block text-sm text-white/30 line-through font-semibold mb-1">
                              R$ {recommendedPlanData.monthlyPrice}/mês
                            </span>
                            <span className="text-4xl md:text-5xl font-black text-white">
                              R$ {discountedPrice(recommendedPlanData.monthlyPrice)}
                            </span>
                            <span className="block text-sm text-white/40 font-semibold">
                              {billingCycle === "YEARLY" ? `R$ ${annualTotal(recommendedPlanData.monthlyPrice).toLocaleString("pt-BR")}/ano` : "plano base mensal"}
                            </span>
                            {billingCycle === "YEARLY" && (
                              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-black">
                                Economia de R$ {annualSavings(recommendedPlanData.monthlyPrice).toLocaleString("pt-BR")}/ano
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/5">
                            <span className="text-[10px] font-black text-primary/60 uppercase tracking-tighter mb-1 block">Mensagens</span>
                            <span className="text-lg font-black text-white">{recommendedPlanData.messagesQuota.toLocaleString("pt-BR")}</span>
                          </div>
                          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/5">
                            <span className="text-[10px] font-black text-primary/60 uppercase tracking-tighter mb-1 block">Tokens IA</span>
                            <span className="text-lg font-black text-white">{recommendedPlanData.aiTokensQuota.toLocaleString("pt-BR")}</span>
                          </div>
                          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/5">
                            <span className="text-[10px] font-black text-primary/60 uppercase tracking-tighter mb-1 block">Contatos CRM</span>
                            <span className="text-lg font-black text-white">{recommendedPlanData.contactsQuota.toLocaleString("pt-BR")}</span>
                          </div>
                        </div>

                        <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-5">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary mb-2 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            {currentDiscount}% off — promoção de lançamento
                          </p>
                          <p className="text-sm text-white/55 leading-relaxed">
                            O valor acima já inclui o desconto de lançamento. Módulos por nicho e add-ons operacionais podem ser contratados conforme a sua necessidade.
                          </p>
                        </div>

                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                          {recommendedPlanData.features.map((feature, i) => (
                            <motion.li
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 + i * 0.05 }}
                              className="flex items-start gap-3 text-sm text-white/70 font-medium"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                              {feature}
                            </motion.li>
                          ))}
                        </ul>

                        {nicheModules.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/8"
                          >
                            <h4 className="text-xs font-black uppercase tracking-widest text-primary/80 mb-4 flex items-center gap-2">
                              <Puzzle className="w-3.5 h-3.5" />
                              Módulos indicados para {selectedNiche?.displayName}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {nicheModules.map((mod, i) => (
                                <motion.div
                                  key={mod.code}
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.6 + i * 0.08 }}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                                >
                                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h5 className="text-xs font-bold text-white truncate">{mod.displayName}</h5>
                                    <p className="text-[10px] text-white/30 truncate">{mod.description}</p>
                                  </div>
                                  <span className="text-xs font-black text-white/30 line-through whitespace-nowrap">
                                    +R$ {mod.monthlyPrice}
                                  </span>
                                </motion.div>
                              ))}
                            </div>
                            <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                                    <Gift className="w-3 h-3" />
                                    Módulos inclusos grátis
                                  </p>
                                  <p className="text-xs text-white/50 mt-1">
                                    Contratando hoje, todos os módulos do seu nicho saem grátis no plano.
                                  </p>
                                </div>
                                <span className="text-sm font-black text-white/30 line-through whitespace-nowrap">
                                  +R$ {nicheModules.reduce((sum, m) => sum + m.monthlyPrice, 0)}/mês
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onSignupClick("TRIAL")}
                          className="w-full h-16 rounded-2xl bg-primary text-black font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-primary/30 hover:shadow-primary/40 transition-shadow"
                        >
                          Começar 7 dias grátis
                          <ArrowRight className="w-5 h-5" />
                        </motion.button>
                        <p className="text-center text-xs text-white/40 mt-3 font-medium">
                          Não requer cartão de crédito. Cancele quando quiser.
                        </p>
                      </div>
                    </motion.div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
                      <button
                        onClick={() => setShowAllPlans(!showAllPlans)}
                        className="text-xs text-white/30 hover:text-white/50 font-bold uppercase tracking-widest transition-colors"
                      >
                        {showAllPlans ? "Ocultar comparação" : "Comparar todos os planos"}
                      </button>
                      <span className="text-white/10 hidden sm:inline">•</span>
                      <button
                        onClick={reset}
                        className="text-xs text-white/30 hover:text-white/50 font-bold uppercase tracking-widest transition-colors"
                      >
                        Refazer análise
                      </button>
                    </div>

                    <AnimatePresence>
                      {showAllPlans && visiblePlans.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.4 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                            {visiblePlans.map((plan) => {
                              const isRecommended = plan.code === recommendedPlan;
                              const PlanIcon = PLAN_ICONS[plan.code] || Zap;
                              return (
                                <div
                                  key={plan.code}
                                  className={cn(
                                    "p-6 rounded-2xl border transition-all flex flex-col",
                                    isRecommended
                                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                                      : "border-white/8 bg-white/[0.02]"
                                  )}
                                >
                                  <div className="flex items-center gap-3 mb-4">
                                    <div className={cn(
                                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                                      isRecommended ? "bg-primary text-black" : "bg-white/10 text-white/40"
                                    )}>
                                      <PlanIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="text-sm font-black text-white flex items-center gap-2 truncate">
                                        {plan.displayName}
                                        {isRecommended && (
                                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-black">INDICADO</span>
                                        )}
                                      </h4>
                                      <span className="text-xs text-white/30 line-through font-semibold">
                                        R$ {plan.monthlyPrice}/mês
                                      </span>
                                      <span className="text-lg font-black text-white block">
                                        R$ {discountedPrice(plan.monthlyPrice)}<span className="text-xs text-white/40 font-semibold">/mês</span>
                                      </span>
                                      {billingCycle === "YEARLY" && (
                                        <span className="text-[10px] text-green-400 font-bold">
                                          R$ {annualTotal(plan.monthlyPrice).toLocaleString("pt-BR")}/ano
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 mb-5 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                                    <div className="flex justify-between items-center text-[10px]">
                                      <span className="text-white/30 font-bold uppercase tracking-tighter">Mensagens</span>
                                      <span className="text-white/70 font-black">{plan.messagesQuota.toLocaleString("pt-BR")}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                      <span className="text-white/30 font-bold uppercase tracking-tighter">Tokens IA</span>
                                      <span className="text-white/70 font-black">{plan.aiTokensQuota.toLocaleString("pt-BR")}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                      <span className="text-white/30 font-bold uppercase tracking-tighter">Contatos</span>
                                      <span className="text-white/70 font-black">{plan.contactsQuota.toLocaleString("pt-BR")}</span>
                                    </div>
                                  </div>

                                  <ul className="space-y-2 mb-6 flex-1">
                                    {plan.features.slice(0, 5).map((f, i) => (
                                      <li key={i} className="flex items-start gap-2 text-xs text-white/50 leading-tight">
                                        <div className="w-1 h-1 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                                        <span className="line-clamp-2">{f}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  <button
                                  onClick={() => onSignupClick("TRIAL")}
                                    className={cn(
                                      "w-full h-11 rounded-xl text-xs font-black transition-all",
                                      isRecommended
                                        ? "bg-primary text-black shadow-lg shadow-primary/10"
                                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10"
                                    )}
                                  >
                                    Iniciar 7 dias grátis
                                  </button>
                                  <p className="text-center text-[10px] text-white/30 mt-2 font-medium">
                                    Sem cartão de crédito
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <p className="mt-6 text-center text-xs text-white/35 leading-relaxed">
                      Os valores públicos abaixo são do plano base. Módulos por nicho e add-ons operacionais são contratados conforme necessidade.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PricingSection;
