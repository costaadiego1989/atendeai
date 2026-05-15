import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export interface AsyncOperationItem {
  id: string;
  title: string;
  description: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  processedItems?: number;
  totalItems?: number;
}

interface AsyncOperationsPanelProps {
  title: string;
  description: string;
  items: AsyncOperationItem[];
}

function getStatusLabel(status: AsyncOperationItem['status']) {
  switch (status) {
    case 'QUEUED':
      return 'Na fila';
    case 'PROCESSING':
      return 'Processando';
    case 'COMPLETED':
      return 'Concluído';
    case 'FAILED':
      return 'Falhou';
    default:
      return status;
  }
}

export function AsyncOperationsPanel({
  title,
  description,
  items,
}: AsyncOperationsPanelProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="glass-card mt-4 space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={[
              'rounded-2xl border p-4 transition-colors duration-300',
              item.status === 'COMPLETED'
                ? 'border-green-500/30 bg-green-500/5'
                : item.status === 'FAILED'
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'border-border/60 bg-muted/20',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-start gap-2">
                {item.status === 'PROCESSING' || item.status === 'QUEUED' ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : item.status === 'COMPLETED' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <Badge
                variant={item.status === 'FAILED' ? 'destructive' : 'secondary'}
                className="shrink-0"
              >
                {getStatusLabel(item.status)}
              </Badge>
            </div>

            {item.status !== 'COMPLETED' && item.status !== 'FAILED' && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.progress}%</span>
                  {typeof item.totalItems === 'number' && item.totalItems > 0 ? (
                    <span>
                      {item.processedItems ?? 0}/{item.totalItems}
                    </span>
                  ) : null}
                </div>
                <Progress value={item.progress} className="h-2.5" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
