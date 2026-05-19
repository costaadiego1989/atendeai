import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useBillingUsageQuery } from '@/modules/billing/view-models/useBillingUsageQuery';

export function QuotaExhaustedBanner() {
  const { tenant } = useAuthStore();
  const navigate = useNavigate();
  const usageQuery = useBillingUsageQuery(tenant?.id);

  if (!tenant?.id || !usageQuery.data) return null;

  const usage = usageQuery.data;

  if (usage.plan === 'TRIAL') return null;

  const messagePercent =
    usage.messages.quota > 0 ? (usage.messages.used / usage.messages.quota) * 100 : 0;
  const aiPercent =
    usage.aiTokens.quota > 0 ? (usage.aiTokens.used / usage.aiTokens.quota) * 100 : 0;

  const exhaustedTypes: string[] = [];
  if (messagePercent >= 100) exhaustedTypes.push('conversas');
  if (aiPercent >= 100) exhaustedTypes.push('tokens de IA');

  if (exhaustedTypes.length === 0) return null;

  const label = exhaustedTypes.join(' e ');

  return (
    <div className="flex items-center justify-between gap-4 bg-destructive/10 px-5 py-2 text-sm border-b border-destructive/20">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>Cota de {label} esgotada.</strong>{' '}
          Novas operações estão bloqueadas até o próximo ciclo ou contratação de pacote adicional.
        </span>
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => navigate('/app/billing/usage')}
        className="group h-7 shrink-0 rounded-full px-3 text-xs font-semibold"
      >
        Ver opções
        <ArrowRight className="ml-1.5 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </div>
  );
}
