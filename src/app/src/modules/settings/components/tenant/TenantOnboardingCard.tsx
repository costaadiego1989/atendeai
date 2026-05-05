import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Loader2, ListChecks } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { companySettingsService } from '@/modules/settings/services/company-settings-service';

function RowList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; title: string; completed: boolean }>;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-2 text-sm">
            {row.completed ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className={row.completed ? 'text-muted-foreground line-through' : 'text-foreground'}>
              {row.title}
            </span>
          </li>
        ))}
      </ul>
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
    const done = all.filter((row) => row.completed).length;
    return { total, done };
  }, [sections, checklist]);

  const isLoading = sectionsQuery.isLoading || checklistQuery.isLoading;
  const isError = sectionsQuery.isError || checklistQuery.isError;

  if (!tenantId) {
    return null;
  }

  if (!isLoading && !isError && sections.length === 0 && checklist.length === 0) {
    return null;
  }

  return (
    <Card className="glass-card mb-6 border-border/70">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-4">
        <div className="rounded-xl bg-primary/10 p-2">
          <ListChecks className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle className="text-lg">Onboarding</CardTitle>
          <CardDescription>
            {summary.total > 0
              ? `${summary.done} de ${summary.total} itens concluídos`
              : 'Acompanhe o que falta configurar na conta'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-0">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando checklist...
          </div>
        )}
        {isError && !isLoading && (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar o onboarding agora. Tente atualizar a página.
          </p>
        )}
        {!isLoading && !isError && (
          <>
            <RowList title="Seções do perfil" rows={sections} />
            <RowList title="Checklist" rows={checklist} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
