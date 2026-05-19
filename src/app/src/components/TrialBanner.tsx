import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/shared/stores/auth-store';
import { cn } from '@/lib/utils';

export function TrialBanner() {
  const { tenant } = useAuthStore();
  const navigate = useNavigate();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!tenant?.createdAt) return;

    const creationDate = new Date(tenant.createdAt);
    const expirationDate = new Date(creationDate);
    expirationDate.setDate(creationDate.getDate() + 7);

    const updateCountdown = () => {
      const now = new Date();
      const diffTime = expirationDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // If trial has expired, we might handle it differently but for now just show 0 or hide
      setDaysLeft(diffDays > 0 ? diffDays : 0);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000 * 60 * 60); // Update every hour

    return () => clearInterval(interval);
  }, [tenant?.createdAt]);

  const isTrial = tenant?.plan === 'TRIAL';

  if (!isTrial || daysLeft === null) return null;

  return (
    <div className="relative isolate overflow-hidden bg-gradient-to-r from-[#0E6477] via-[#107B8F] to-[#159BB5] px-6 py-2.5 sm:px-3.5 sm:before:flex-1">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,hsl(var(--primary)/0.2),transparent)] opacity-40" />
      <div className="absolute inset-y-0 right-1/2 -z-10 mr-16 w-[200%] origin-bottom-left skew-x-[-30deg] bg-white/5 shadow-xl shadow-primary/10 ring-1 ring-white/10 backdrop-blur-3xl" />
      
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-sm leading-6 text-white">
          <Sparkles className="h-4 w-4 text-[hsl(var(--accent))] animate-pulse" />
          <p>
            <strong className="font-semibold text-white">Período de Experiência Ativo</strong>
            <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
              <circle cx="1" cy="1" r="1" />
            </svg>
            Seu trial gratuito encerra em <span className="font-bold underline decoration-[hsl(var(--accent))] underline-offset-4">{daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}</span>. Aproveite todos os recursos agora!
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => navigate('/app/billing/usage')}
            className="group h-8 rounded-full bg-white/20 px-4 text-xs font-semibold text-white hover:bg-white/30 border-none transition-all hover:scale-105 active:scale-95"
          >
            Assinar agora
            <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Button>
          
          <div className="hidden h-4 w-px bg-white/20 sm:block" />
          
          <div className="flex items-center gap-1.5 text-[11px] text-white/80">
            <Clock className="h-3.5 w-3.5 text-white/60" />
            <span>Trial de 7 dias</span>
          </div>
        </div>
      </div>
    </div>
  );
}
