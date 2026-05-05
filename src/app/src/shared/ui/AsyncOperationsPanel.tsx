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
          <div key={item.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {getStatusLabel(item.status)}
              </Badge>
            </div>

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
          </div>
        ))}
      </div>
    </div>
  );
}
