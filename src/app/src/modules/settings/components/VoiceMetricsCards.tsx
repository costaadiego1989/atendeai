import { Card, CardContent } from '@/components/ui/card';
import { Phone, CheckCircle2, TrendingUp, DollarSign } from 'lucide-react';
import type { VoiceMetrics } from '../services/voice-service';

interface VoiceMetricsCardsProps {
  metrics: VoiceMetrics | null;
}

export function VoiceMetricsCards({ metrics }: VoiceMetricsCardsProps) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="glass-card animate-pulse">
            <CardContent className="p-4">
              <div className="h-3 w-16 bg-muted rounded mb-2" />
              <div className="h-6 w-12 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      icon: Phone,
      label: 'Total de chamadas',
      value: metrics.totalCalls.toLocaleString('pt-BR'),
    },
    {
      icon: CheckCircle2,
      label: 'Taxa de atendimento',
      value: `${metrics.answeredRate}%`,
    },
    {
      icon: TrendingUp,
      label: 'Taxa de acordo',
      value: `${metrics.agreementRate}%`,
    },
    {
      icon: DollarSign,
      label: 'Valor recuperado',
      value: `R$ ${metrics.totalRecovered.toLocaleString('pt-BR')}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-1 text-xl font-bold text-foreground">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
