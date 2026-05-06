import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Sparkles, Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { publicService } from "@/services/PublicService";
import { formatDocument, formatPhone } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolveAppBaseUrl } from "@/services/runtime-env";

const formSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  companyName: z.string().min(2, "Nome da empresa obrigatório"),
  nicheCode: z.string().min(1, "Selecione o segmento da empresa"),
  cpf: z.string().min(14, "CPF inválido"),
  cnpj: z.string().min(18, "CNPJ inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type FormValues = z.infer<typeof formSchema>;

interface TrialSignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planCode: string;
}

const TrialSignupDialog: React.FC<TrialSignupDialogProps> = ({
  open,
  onOpenChange,
  planCode,
}) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const { data: plansData } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => publicService.getPlans(),
  });

  const { data: nichesData } = useQuery({
    queryKey: ["public-niches"],
    queryFn: () => publicService.getNiches(),
  });

  const selectedPlan = plansData?.plans?.find((p) => p.code === planCode);
  const selectedPlanName = selectedPlan?.displayName ?? planCode;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      companyName: "",
      nicheCode: "",
      cpf: "",
      cnpj: "",
      password: "",
    },
  });

  const onNextStep = async () => {
    const valid = await form.trigger(["name", "email", "phone", "companyName", "nicheCode"]);
    if (valid) {
      setStep(2);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await publicService.initiateTrial({
        name: values.name,
        email: values.email,
        phone: values.phone,
        companyName: values.companyName,
        cpf: values.cpf,
        cnpj: values.cnpj,
        nicheCode: values.nicheCode,
        password: values.password,
        plan: planCode,
      });

      setStep(3);

      const appUrl = resolveAppBaseUrl();

      setTimeout(() => {
        toast.success("Trial ativado com sucesso! Redirecionando...");
        window.location.href = `${appUrl}/login`;
      }, 2500);

    } catch (error: any) {
      toast.error(error.message || "Erro ao processar sua solicitação.");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) setStep(1);
    }}>
      <DialogContent className="sm:max-w-[480px] bg-[#080c0d] border-white/5 text-white p-0 rounded-[2.5rem] shadow-[0_0_120px_rgba(0,0,0,0.9)] outline-none overflow-hidden border-none focus-within:ring-0">

        {/* Step Indicator Top Bar */}
        <div className="flex w-full h-1.5 gap-1 p-0 absolute top-0 left-0 z-50">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "flex-1 transition-all duration-700",
                step >= s ? "bg-[#00C59E]" : "bg-white/10"
              )}
            />
          ))}
        </div>

        <div className="p-8 md:p-12">
          <AnimatePresence mode="wait">
            {step < 3 ? (
              <motion.div
                key="form-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DialogHeader className="mb-10 relative text-left">
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="w-4 h-4 text-[#00C59E]" />
                    <span className="text-[9px] font-black text-[#00C59E] uppercase tracking-[0.3em]">
                      {step === 1 ? "01 . Identificação" : "02 . Criação de Conta"}
                    </span>
                  </div>

                  <DialogTitle className="text-3xl font-black tracking-tighter text-white leading-[1.1] mb-4">
                    Ative seus <span className="text-[#00C59E]">7 dias de ELITE</span>
                  </DialogTitle>

                  <DialogDescription className="text-sm text-white/40 leading-relaxed font-medium">
                    Você escolheu o <span className="text-[#00C59E] font-bold">{selectedPlanName}</span>. <br />Vamos criar sua conta e iniciar seu trial.
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <AnimatePresence mode="wait">
                      {step === 1 && (
                        <motion.div
                          key="step1"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-5"
                        >
                          <div className="grid grid-cols-1 gap-5">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem className="space-y-2">
                                  <FormLabel className="text-[9px] font-black text-white/30 uppercase tracking-widest pl-1">Nome Completo</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Seu nome" {...field} className="h-14 bg-white/5 border-white/5 rounded-2xl focus:border-[#00C59E]/50 focus:ring-0 transition-all text-sm font-bold placeholder:text-white/10" />
                                  </FormControl>
                                  <FormMessage className="text-[10px] font-bold text-red-400" />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem className="space-y-2">
                                  <FormLabel className="text-[9px] font-black text-white/30 uppercase tracking-widest pl-1">E-mail de Trabalho</FormLabel>
                                  <FormControl>
                                    <Input placeholder="seu@email.com" {...field} className="h-14 bg-white/5 border-white/5 rounded-2xl focus:border-[#00C59E]/50 focus:ring-0 transition-all text-sm font-bold placeholder:text-white/10" />
                                  </FormControl>
                                  <FormMessage className="text-[10px] font-bold text-red-400" />
                                </FormItem>
                              )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                  <FormItem className="space-y-2">
                                    <FormLabel className="text-[9px] font-black text-white/30 uppercase tracking-widest pl-1">WhatsApp</FormLabel>
                                    <FormControl>
                                      <Input placeholder="(00) 00000-0000" {...field} className="h-14 bg-white/5 border-white/5 rounded-2xl focus:border-[#00C59E]/50 focus:ring-0 transition-all text-sm font-bold placeholder:text-white/10" onChange={(e) => field.onChange(formatPhone(e.target.value))} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="companyName"
                                render={({ field }) => (
                                  <FormItem className="space-y-2">
                                    <FormLabel className="text-[9px] font-black text-white/30 uppercase tracking-widest pl-1">Empresa</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Nome da Loja/Clínica" {...field} className="h-14 bg-white/5 border-white/5 rounded-2xl focus:border-[#00C59E]/50 focus:ring-0 transition-all text-sm font-bold placeholder:text-white/10" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                            <FormField
                              control={form.control}
                              name="nicheCode"
                              render={({ field }) => (
                                <FormItem className="space-y-2">
                                  <FormLabel className="text-[9px] font-black text-white/30 uppercase tracking-widest pl-1">Tipo de Empresa (Nicho)</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-14 bg-white/5 border-white/5 rounded-2xl focus:border-[#00C59E]/50 focus:ring-0 transition-all text-sm font-bold text-white/60">
                                        <SelectValue placeholder="Selecione seu segmento" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="bg-[#080c0d] border-white/10 text-white rounded-xl">
                                      {nichesData?.niches?.map((niche) => (
                                        <SelectItem key={niche.code} value={niche.code} className="focus:bg-[#00C59E]/20 focus:text-white cursor-pointer">
                                          {niche.displayName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>

                          <Button
                            type="button"
                            onClick={onNextStep}
                            className="w-full h-14 bg-[#00C59E] hover:bg-[#00C59E]/90 text-black font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-[0_15px_30px_-5px_rgba(0,197,158,0.3)] transition-all hover:scale-[1.01] active:scale-[0.98] mt-4"
                          >
                            PRÓXIMO PASSO <ArrowRight className="ml-2 w-4 h-4" />
                          </Button>
                        </motion.div>
                      )}

                      {step === 2 && (
                        <motion.div
                          key="step2"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-5"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="cpf"
                              render={({ field }) => (
                                <FormItem className="space-y-2">
                                  <FormLabel className="text-[9px] font-black text-white/30 uppercase tracking-widest pl-1">CPF do Titular</FormLabel>
                                  <FormControl>
                                    <Input placeholder="000.000.000-00" {...field} className="h-14 bg-white/5 border-white/5 rounded-2xl focus:border-[#00C59E]/50 focus:ring-0 transition-all text-sm font-bold placeholder:text-white/10" onChange={(e) => field.onChange(formatDocument(e.target.value))} />
                                  </FormControl>
                                  <FormMessage className="text-[10px] font-bold text-red-400" />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="cnpj"
                              render={({ field }) => (
                                <FormItem className="space-y-2">
                                  <FormLabel className="text-[9px] font-black text-white/30 uppercase tracking-widest pl-1">CNPJ da Empresa</FormLabel>
                                  <FormControl>
                                    <Input placeholder="00.000.000/0000-00" {...field} className="h-14 bg-white/5 border-white/5 rounded-2xl focus:border-[#00C59E]/50 focus:ring-0 transition-all text-sm font-bold placeholder:text-white/10" onChange={(e) => field.onChange(formatDocument(e.target.value))} />
                                  </FormControl>
                                  <FormMessage className="text-[10px] font-bold text-red-400" />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem className="space-y-2">
                                <FormLabel className="text-[9px] font-black text-white/30 uppercase tracking-widest pl-1">Senha de Acesso</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="Definir senha de acesso" {...field} className="h-14 bg-white/5 border-white/5 rounded-2xl focus:border-[#00C59E]/50 focus:ring-0 transition-all text-sm font-bold placeholder:text-white/10" />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <div className="flex gap-3 pt-4">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setStep(1)}
                              className="h-14 w-14 shrink-0 rounded-2xl border border-white/5 hover:bg-white/5 text-white/40"
                            >
                              <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <Button
                              type="submit"
                              disabled={loading}
                              className="flex-1 h-14 bg-[#00C59E] hover:bg-[#00C59E]/90 text-black font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-[0_15px_30px_-5px_rgba(0,197,158,0.3)] transition-all"
                            >
                              {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                "CONCLUIR ATIVAÇÃO"
                              )}
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </form>
                </Form>
              </motion.div>
            ) : (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="w-24 h-24 rounded-full bg-[#00C59E]/10 flex items-center justify-center mb-8 relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-x-0 inset-y-0 rounded-full border-2 border-dashed border-[#00C59E]/30"
                  />
                  <CheckCircle2 className="w-12 h-12 text-[#00C59E]" />
                </div>

                <h3 className="text-2xl font-black tracking-tighter text-white mb-3">Ativando seu trial</h3>
                <p className="text-sm text-white/40 max-w-[280px] leading-relaxed">
                  Preparando sua conta no plano {selectedPlanName}. Você será redirecionado em instantes.
                </p>

                <div className="mt-12 flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00C59E] animate-bounce" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00C59E] animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00C59E] animate-bounce [animation-delay:-0.3s]" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {step < 3 && (
            <div className="mt-10 flex items-center justify-center gap-4 text-[9px] font-black uppercase tracking-widest text-white/20">
              <div className="flex items-center gap-1.5 text-[#00C59E]/60">
                <CheckCircle2 className="w-3 h-3" />
                Sem cartão agora
              </div>
              <div className="w-1 h-1 bg-white/10 rounded-full" />
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                7 Dias Free
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrialSignupDialog;
