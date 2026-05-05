import { useEffect, useRef } from 'react';
import { Building2, ChevronDown, Store } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/shared/stores/auth-store';
import { cn } from '@/lib/utils';

const HEADQUARTERS_SCOPE_KEY = '__headquarters__';

export function ActiveBranchSelector() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const setActiveBranchId = useAuthStore((state) => state.setActiveBranchId);
  const previousScopeKeyRef = useRef<string | null>(null);
  
  const allowedBranchIds = new Set(user?.accessibleBranchIds ?? []);
  const branches = (tenant?.branches ?? []).filter(
    (branch) => branch.active && (allowedBranchIds.size === 0 || allowedBranchIds.has(branch.id))
  );
  
  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const isHeadquartersScope = !activeBranchId;
  const scopeKey = activeBranchId ?? HEADQUARTERS_SCOPE_KEY;

  useEffect(() => {
    if (!tenant?.id) {
      previousScopeKeyRef.current = null;
      return;
    }

    if (previousScopeKeyRef.current === null) {
      previousScopeKeyRef.current = scopeKey;
      return;
    }

    if (previousScopeKeyRef.current === scopeKey) {
      return;
    }

    previousScopeKeyRef.current = scopeKey;

    const scopedQueryKeys: Array<readonly unknown[]> = [
      ['dashboard-snapshot', tenant.id],
      ['contacts', tenant.id],
      ['conversations', tenant.id],
      ['checkout-orders', tenant.id],
      ['checkout-orders-for-conversations', tenant.id],
      ['recovery-cases', tenant.id],
      ['recovery-create-contacts', tenant.id],
      ['sales-payment-links'],
      ['sales-metrics'],
      ['sales-metrics-recent-links'],
      ['alert-reminders'],
      ['support-feedbacks'],
      ['scheduling-professionals', tenant.id],
      ['scheduling-categories', tenant.id],
      ['scheduling-category-professionals', tenant.id],
      ['scheduling-category-availability', tenant.id],
      ['scheduling-google-calendar-connection-status', tenant.id],
      ['scheduling-google-calendar-calendars', tenant.id],
      ['agent-rule', tenant.id],
      ['global-conversation-notifier-fallback', tenant.id],
    ];

    for (const queryKey of scopedQueryKeys) {
      queryClient.removeQueries({ queryKey, exact: false });
      void queryClient.invalidateQueries({
        queryKey,
        exact: false,
        refetchType: 'active',
      });
    }
  }, [activeBranchId, queryClient, scopeKey, tenant?.id]);

  const handleBranchChange = (branchId: string | null) => {
    if (branchId === activeBranchId) {
      return;
    }

    setActiveBranchId(branchId);
  };

  if (!tenant) return null;

  const hasBranches = branches.length > 0;

  return (
    <div className="flex items-center gap-0">
      <div
        className="group relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-colors"
        title={`Tenant ID: ${tenant.id}${activeBranchId ? ` | Branch ID: ${activeBranchId}` : ''}`}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          <Building2 className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold leading-tight text-foreground">
            {tenant.name}
          </span>
          {!hasBranches && (
            <span className="text-[10px] leading-tight text-muted-foreground">
              Sede única
            </span>
          )}
          {hasBranches && !activeBranch && (
            <span className="text-[10px] leading-tight text-muted-foreground">
              Matriz
            </span>
          )}
          {hasBranches && activeBranch && (
            <span className="text-[10px] leading-tight text-muted-foreground">
              {activeBranch.isHeadquarters ? 'Matriz' : 'Filial'}
            </span>
          )}
        </div>
      </div>

      {hasBranches && (
        <>
          <span className="mx-1 text-muted-foreground/30 select-none">›</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex h-8 min-w-[160px] max-w-[220px] items-center gap-1.5 rounded-md border-none bg-muted/40 px-2.5 text-[13px] font-medium shadow-none outline-none',
                  'hover:bg-muted/70 transition-colors',
                  'focus:ring-1 focus:ring-primary/20',
                )}
              >
                <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left truncate">
                  {activeBranch?.name ?? 'Matriz'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px]">
              <DropdownMenuItem
                onSelect={() => handleBranchChange(null)}
                className="flex flex-col items-start gap-1 py-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="font-medium text-[13px]">Matriz</span>
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0 text-[10px] leading-4 h-4 ml-auto"
                  >
                    Principal
                  </Badge>
                </div>
                {isHeadquartersScope && (
                  <span className="text-[10px] text-primary font-medium uppercase tracking-wider">
                    Ativa no momento
                  </span>
                )}
              </DropdownMenuItem>
              {branches.map((branch) => (
                <DropdownMenuItem
                  key={branch.id}
                  onSelect={() => handleBranchChange(branch.id)}
                  className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-medium text-[13px]">{branch.name}</span>
                    {branch.isHeadquarters && (
                      <Badge
                        variant="secondary"
                        className="px-1.5 py-0 text-[10px] leading-4 h-4 ml-auto"
                      >
                        Matriz
                      </Badge>
                    )}
                  </div>
                  {branch.id === activeBranchId && (
                    <span className="text-[10px] text-primary font-medium uppercase tracking-wider">
                      Ativa no momento
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
