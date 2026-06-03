import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const isNearLimit = value >= 80;

  return (
    <Card className="bg-card border border-border/60">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="w-full space-y-5">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {title}
              </p>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="space-y-2">
              <Progress
                value={value}
                className={cn('h-2', isNearLimit && '[&>div]:bg-destructive')}
              />
              <p
                className={cn(
                  'text-xs',
                  isNearLimit ? 'font-medium text-destructive' : 'text-muted-foreground',
                )}
              >
                {value.toFixed(0)}% utilizado
              </p>
            </div>
          </div>
          <div
            className={cn(
              'rounded-full p-2.5',
              isNearLimit ? 'bg-destructive/10' : 'bg-primary/10',
            )}
          >
            <Icon className={cn('h-5 w-5', isNearLimit ? 'text-destructive' : 'text-primary')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
