import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Loader2, Rocket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { companySettingsService } from '@/modules/settings/services/company-settings-service';

type Row = { id: string; title: string; completed: boolean };

function ItemRow({ row }: { row: Row }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors',
        row.completed
          ? 'border-emerald-500/20 bg-emerald-500/[0.05]'
          : 'border-border/50 bg-background/60',
      )}
    >
      {row.completed ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      ) : (
        <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
      )}
      <span
        className={cn(
          'text-xs leading-snug',
          row.completed ? 'text-muted-foreground line-through' : 'text-foreground',
        )}
      >
        {row.title}
      </span>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {rows.map((row) => (
          <ItemRow key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}

function ProgressRing({
  percent,
  done,
  total,
}: {
  percent: number;
  done: number;
  total: number;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;

  const color =
    percent >= 85
      ? 'text-emerald-500'
      : percent >= 50
        ? 'text-amber-400'
        : 'text-rose-400';

  const strokeColor =
    percent >= 85
      ? '#10b981'
      : percent >= 50
        ? '#fbbf24'
        : '#f87171';

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg width="72" height="72" className="-rotate-90">
        <circle
          cx="36"
          cy="36"
          r={radius}
          strokeWidth="5"
          fill="none"
          className="stroke-border/30"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          strokeWidth="5"
          fill="none"
          stroke={strokeColor}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('text-base font-bold leading-none', color)}>{percent}%</span>
        <span className="mt-0.5 text-[9px] text-muted-foreground">
          {done}/{total}
        </span>
      </div>
    </div>
  );
}

export function TenantOnboardingCard({ tenantId }: { tenantId?: string }) {
  const sectionsQuery = useQuery({
    queryKey: ['tenant-profile-sections', tenantId],
    queryFn: () => companySettingsService.getProfileSections(tenantId!),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  const checklistQuery = useQuery({
    queryKey: ['tenant-onboarding-checklist', tenantId],
    queryFn: () => companySettingsService.getOnboardingChecklist(tenantId!),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  const sections = sectionsQuery.data ?? [];
  const checklist = checklistQuery.data ?? [];

  const summary = useMemo(() => {
    const all = [...sections, ...checklist];
    const total = all.length;
    const done = all.filter((r) => r.completed).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, percent };
  }, [sections, checklist]);

  const nextSteps = useMemo(
    () => checklist.filter((r) => !r.completed).slice(0, 2),
    [checklist],
  );

  const isLoading = sectionsQuery.isLoading || checklistQuery.isLoading;
  const isError = sectionsQuery.isError || checklistQuery.isError;

  if (!tenantId) return null;
  if (!isLoading && !isError && sections.length === 0 && checklist.length === 0) return null;

  return (
    <Card className="glass-card mb-6 overflow-hidden border-border/60">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border/50 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2">
            <Rocket className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Onboarding</p>
            <p className="text-xs text-muted-foreground">
              {summary.total > 0
                ? `${summary.done} de ${summary.total} itens concluídos`
                : 'Acompanhe o que falta configurar'}
            </p>
          </div>
        </div>

        {!isLoading && summary.total > 0 && (
          <ProgressRing
            percent={summary.percent}
            done={summary.done}
            total={summary.total}
          />
        )}
      </div>

      <CardContent className="space-y-4 px-6 py-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando checklist...
          </div>
        )}

        {isError && !isLoading && (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar o onboarding. Tente atualizar a página.
          </p>
        )}

        {!isLoading && !isError && (
          <>
            <Section title="Seções do perfil" rows={sections} cols={2} />
            <Section title="Checklist operacional" rows={checklist} cols={1} />

            {nextSteps.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                  Próximos passos
                </p>
                <ul className="space-y-1">
                  {nextSteps.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm text-foreground">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      {item.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
