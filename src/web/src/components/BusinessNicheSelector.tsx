import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Scissors,
  Briefcase,
  Wrench,
  CheckCircle2,
  Calendar,
  MessageSquare,
  ShoppingCart,
  Users,
  FileText,
  Dog,
  Shirt,
  Store,
  Home,
  Utensils,
  GraduationCap,
  Dumbbell,
  Smartphone,
  ArrowRight,
  TrendingUp,
  Clock,
  Skull,
  Sparkles,
  Settings,
  Info
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { publicService, PlanAPI, NicheAPI, ModuleAPI } from "@/services/PublicService";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, any> = {
  Stethoscope,
  Scissors,
  Briefcase,
  Wrench,
  Dog,
  Shirt,
  Store,
  Home,
  Utensils,
  GraduationCap,
  Dumbbell,
  Smartphone,
  Settings
};

const ModuleDetailModal = ({ module, open, onOpenChange }: { module: ModuleAPI | null, open: boolean, onOpenChange: (open: boolean) => void }) => {
  if (!module) return null;

  const config = (module.config as any) || {};
  const benefits = config.benefits || ["Aumento de produtividade", "Escalabilidade operacional", "Melhor experiência para o cliente"];
  const technical = config.technical || ["DeepSeek AI Core", "Real-time Processing", "Enterprise Architecture"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] bg-[#080c0d] border-white/5 text-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_0_120px_rgba(0,0,0,0.9)] outline-none overflow-hidden">
        <DialogHeader className="mb-8 relative text-left">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-4 h-4 text-[#00C59E]" />
            <span className="text-[9px] font-black text-[#00C59E] uppercase tracking-[0.3em]">Documentação do Módulo</span>
          </div>

          <DialogTitle className="text-4xl font-black tracking-tighter text-white leading-tight mb-4">
            {module.displayName}
          </DialogTitle>

          <DialogDescription className="text-base text-white/50 leading-relaxed font-medium text-pretty">
            {module.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-10">
          <div>
            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-6">Principais Benefícios:</p>
            <div className="space-y-4">
              {benefits.map((benefit: string, i: number) => (
                <div key={i} className="flex items-start gap-4 group">
                  <div className="w-7 h-7 rounded-full bg-[#00C59E]/10 flex items-center justify-center shrink-0 border border-[#00C59E]/20 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00C59E]" />
                  </div>
                  <span className="text-[15px] font-bold text-white/80 tracking-tight leading-relaxed">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12">
          <button
            onClick={() => onOpenChange(false)}
            className="w-full py-5 rounded-2xl bg-[#00C59E] text-black font-black text-xs uppercase tracking-[0.3em] hover:brightness-110 hover:scale-[1.01] active:scale-[0.98] transition-all shadow-[0_20px_40px_-10px_rgba(0,197,158,0.4)] flex items-center justify-center"
          >
            ENTENDI, FECHAR
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const BusinessNicheSelector: React.FC<{ onSignupClick: (planCode: string) => void }> = ({ onSignupClick }) => {
  const [niches, setNiches] = useState<NicheAPI[]>([]);
  const [modules, setModules] = useState<ModuleAPI[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [basePlans, setBasePlans] = useState<PlanAPI[]>([]);
  const [basePlanCode, setBasePlanCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<ModuleAPI | null>(null);

  useEffect(() => {
    Promise.all([
      publicService.getPlans(),
      publicService.getNiches(),
      publicService.getModules()
    ])
      .then(([plansResp, nichesResp, modulesResp]) => {
        setBasePlans(plansResp.plans.filter(p => p.isStandard));
        setNiches(nichesResp.niches);
        setModules(modulesResp.modules);

        if (plansResp.plans.length > 0) {
          setBasePlanCode(plansResp.plans[0].code);
        }
        if (nichesResp.niches.length > 0) {
          setSelectedId(nichesResp.niches[0].code);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao carregar dados de faturamento:", err);
        setLoading(false);
      });
  }, []);

  const selectedNiche = niches.find(n => n.code === selectedId) || niches[0];
  const selectedBase = basePlans.find(p => p.code === basePlanCode);

  const modularPrice = selectedNiche?.modules.reduce((sum, modCode) => {
    const mod = modules.find(m => m.code === modCode);
    return sum + (mod?.monthlyPrice || 0);
  }, 0) || 0;

  const totalPrice = (selectedBase?.monthlyPrice || 0) + modularPrice;

  if (loading) return (
    <div className="flex items-center justify-center p-24">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start max-w-7xl mx-auto font-inter">
      <ModuleDetailModal
        module={selectedModule}
        open={!!selectedModule}
        onOpenChange={(open) => !open && setSelectedModule(null)}
      />

      {/* Sidebar - Niche Navigation */}
      <div className="w-full lg:w-72 shrink-0 flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 gap-1.5 no-scrollbar">
        {niches.map((niche) => {
          const Icon = ICON_MAP[niche.iconName || 'Settings'] || Store;
          return (
            <button
              key={niche.code}
              onClick={() => setSelectedId(niche.code)}
              className={cn(
                "whitespace-nowrap lg:whitespace-normal px-5 py-3.5 rounded-xl text-[12px] font-black transition-all border text-left flex items-center gap-3",
                selectedId === niche.code
                  ? "bg-[#00C59E] border-[#00C59E] text-black shadow-lg shadow-[#00C59E]/20"
                  : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", selectedId === niche.code ? "text-black" : "text-[#00C59E]")} />
              {niche.displayName}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-col xl:flex-row gap-8 items-stretch">
              {/* Specialized Content */}
              <div className="flex-1 enterprise-card border-white/10 rounded-[2.5rem] p-8 lg:p-12">
                <div>
                  <div className="inline-flex items-center gap-2 mb-6 text-[#00C59E]">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-black text-[10px] tracking-[0.2em] uppercase">Setor Selecionado</span>
                  </div>
                  <h3 className="text-3xl md:text-5xl font-black text-white mb-8 leading-tight tracking-tighter text-pretty">
                    Solução <span className="text-[#00C59E]">{selectedNiche?.displayName}</span>
                  </h3>

                  <div className="mb-10">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6">Foco na Resolução de Problemas:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedNiche.pains.map((pain, pi) => (
                        <div key={pi} className="flex items-start gap-4 text-sm font-semibold text-white/60 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-[#00C59E]/20 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-[#00C59E]/10 flex items-center justify-center shrink-0 border border-[#00C59E]/20 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#00C59E]" />
                          </div>
                          <span className="leading-relaxed">{pain}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6">Inteligência Elite Ativada:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedNiche?.modules.map((modCode, i) => {
                        const mod = modules.find(m => m.code === modCode);
                        const displayName = mod?.displayName || modCode;
                        return (
                          <div key={i} className="flex flex-col p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-[#00C59E]/20 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ArrowRight className="w-3 h-3 text-[#00C59E]/40" />
                            </div>
                            <div className="flex items-start gap-4">
                              <div className="w-7 h-7 rounded-full bg-[#00C59E]/10 flex items-center justify-center shrink-0 border border-[#00C59E]/20 mt-0.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#00C59E]" />
                              </div>
                              <div className="flex flex-col gap-2 text-left items-start">
                                <span className="text-sm font-bold text-white/90 leading-tight w-full text-left">{displayName}</span>
                                <button
                                  onClick={() => setSelectedModule(mod || null)}
                                  className="flex items-center justify-start gap-2 text-[9px] font-black text-[#00C59E] uppercase tracking-[0.2em] hover:gap-3 transition-all w-fit text-left"
                                >
                                  Conhecer em detalhes <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full xl:w-[420px] shrink-0">
                <div className="enterprise-card border-white/10 rounded-[2.5rem] p-10 flex flex-col h-full relative overflow-hidden group">
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#00C59E]/10 blur-[80px] rounded-full group-hover:bg-[#00C59E]/20 transition-all duration-700" />

                  <div className="relative mb-10 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1 w-8 bg-[#00C59E] rounded-full" />
                      <span className="text-[10px] font-black text-[#00C59E] uppercase tracking-[0.2em]">Resumo Combo Elite</span>
                    </div>
                    <h4 className="text-2xl font-black text-white tracking-tighter">Assinatura <span className="text-[#00C59E]">Unificada</span></h4>
                  </div>

                  <div className="space-y-6 mb-12">
                    <div className="p-1.5 bg-black/40 rounded-2xl border border-white/10 flex gap-1">
                      {basePlans.map((plan) => (
                        <button
                          key={plan.code}
                          onClick={() => setBasePlanCode(plan.code)}
                          className={cn(
                            "flex-1 py-3 px-2 rounded-xl text-[10px] font-black transition-all",
                            basePlanCode === plan.code
                              ? "bg-[#00C59E] text-black shadow-lg"
                              : "bg-transparent text-white/40 hover:text-white/60"
                          )}
                        >
                          {plan.displayName.replace('Plano ', '')}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-white/40" />
                          <span className="text-[11px] font-bold text-white/60">Base: {selectedBase?.displayName.split(' (')[0]}</span>
                        </div>
                        <span className="text-xs font-black text-white tracking-tighter italic tabular-nums">R$ {selectedBase?.monthlyPrice}</span>
                      </div>

                      <div className="flex justify-between items-center bg-[#00C59E]/5 p-4 rounded-xl border border-[#00C59E]/10">
                        <div className="flex items-center gap-3">
                          <Sparkles className="w-4 h-4 text-[#00C59E]" />
                          <span className="text-[11px] font-bold text-white/60">Especialista {selectedNiche?.displayName}</span>
                        </div>
                        <span className="text-xs font-black text-[#00C59E] tracking-tighter italic tabular-nums">+ R$ {modularPrice}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-8 border-t border-white/5 text-left xl:text-center">
                    <div className="flex items-baseline xl:justify-center gap-1 mb-8">
                      <span className="text-xs font-black italic text-[#00C59E]">R$</span>
                      <span className="text-7xl font-black tracking-tighter tabular-nums text-white">
                        {totalPrice}
                      </span>
                      <span className="text-sm font-bold text-white/30">/mês</span>
                    </div>

                    <button
                      onClick={() => onSignupClick(basePlanCode)}
                      className="w-full py-6 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-[0.25em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-3 group/btn"
                    >
                      ATIVAR ACESSO AGORA
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>

                    <div className="mt-8 flex items-center xl:justify-center gap-4 text-[9px] font-black uppercase tracking-widest text-white/20">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#00C59E]" />
                        Setup Grátis
                      </div>
                      <div className="w-1 h-1 bg-white/10 rounded-full" />
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#00C59E]" />
                        7 Dias Free
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
