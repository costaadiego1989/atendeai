import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/shared/lib/formatters';
import type { Tenant } from '@/shared/types';
import { getTenantAuditLabel } from './tenant-view-helpers';

interface TenantAuditTabProps {
  tenantData?: Tenant;
}

export function TenantAuditTab({ tenantData }: TenantAuditTabProps) {
  const auditLogs = tenantData?.recentAuditLogs ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Trilha de Auditoria</p>
              <p className="text-xs text-muted-foreground">
                Histórico recente de alterações críticas realizadas na empresa.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold">
            {auditLogs.length} evento(s)
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {auditLogs.length ? (
          auditLogs.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-background/80"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {getTenantAuditLabel(entry.eventType)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Realizado por: <span className="font-medium text-foreground/80">{entry.email ?? 'Usuário não identificado'}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <p className="text-xs font-medium text-muted-foreground">
                    {formatDateTime(entry.createdAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }) ?? 'Sem horário'}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/5 py-12 text-center">
             <ShieldCheck className="mb-3 h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">
              Nenhuma alteração crítica registrada até o momento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
