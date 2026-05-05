import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CreditCard } from 'lucide-react';

interface BillingUsageProgressCardProps {
  title: string;
  subtitle: string;
  value: number;
  icon: typeof CreditCard;
}

export function BillingUsageProgressCard({
  title,
  subtitle,
  value,
  icon: Icon,
}: BillingUsageProgressCardProps) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="w-full space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {title}
              </p>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="space-y-2">
              <Progress value={value} className="h-2" />
              <p className="text-xs text-muted-foreground">{value.toFixed(0)}% utilizado</p>
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
