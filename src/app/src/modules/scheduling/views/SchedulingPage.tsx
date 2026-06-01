import { PageTabsList } from '@/components/PageTabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { SchedulingCategoriesTab } from '@/modules/scheduling/components/SchedulingCategoriesTab';
import { SchedulingDialogs } from '@/modules/scheduling/components/SchedulingDialogs';
import { SchedulingGoogleCalendarCard } from '@/modules/scheduling/components/SchedulingGoogleCalendarCard';
import { SchedulingHeader } from '@/modules/scheduling/components/SchedulingHeader';
import { SchedulingOverviewCards } from '@/modules/scheduling/components/SchedulingOverviewCards';
import { SchedulingProfessionalsTab } from '@/modules/scheduling/components/SchedulingProfessionalsTab';
import { useSchedulingPageViewModel } from '@/modules/scheduling/view-models/useSchedulingPageViewModel';
import { AsyncOperationsPanel } from '@/shared/ui/AsyncOperationsPanel';
import { CalendarDays, Download, ScissorsSquare, Users } from 'lucide-react';

export default function SchedulingPage() {
  const vm = useSchedulingPageViewModel();

  return (
    <div className="page-container animate-fade-in">
      <SchedulingHeader />

      <AsyncOperationsPanel
        title="Processamentos em andamento"
        description="Processando em segundo plano — você pode continuar usando normalmente."
        items={vm.schedulingActiveJobItems}
      />

      <Card className="glass-card border-border/40 bg-background/30 mb-6">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/70">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Relatório da agenda</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-3 rounded-xl border border-border/60 bg-background/60 p-1">
              {[
                { label: 'Hoje', days: 0 },
                { label: '7 dias', days: 7 },
                { label: '30 dias', days: 30 },
              ].map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  variant={vm.activeReportPeriodDays === option.days ? 'default' : 'ghost'}
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  onClick={() => {
                    const start = new Date();
                    const end = new Date();
                    if (option.days > 0) end.setDate(end.getDate() + option.days);
                    vm.setReportFilters((current) => ({
                      ...current,
                      startDate: start.toISOString().slice(0, 10),
                      endDate: end.toISOString().slice(0, 10),
                    }));
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl px-4"
              onClick={() => vm.setReportsOpen(true)}
            >
              <Download className="h-4 w-4" />
              Relatórios
            </Button>
          </div>
        </CardContent>
      </Card>

      <SchedulingGoogleCalendarCard />

      <SchedulingOverviewCards vm={vm} />

      <Tabs
        value={vm.activeTab}
        onValueChange={(value) => vm.setActiveTab(value as 'professionals' | 'categories')}
        className="space-y-6 pt-5"
      >
        <div className="flex max-w-full overflow-hidden">
          <div className="w-full max-w-full sm:w-auto">
            <PageTabsList
              tabs={[
                { value: 'professionals', label: 'Profissionais', icon: Users },
                { value: 'categories', label: 'Categorias', icon: ScissorsSquare },
              ]}
              className="w-full justify-start sm:w-fit"
            />
          </div>
        </div>

        <TabsContent value="professionals" className="m-0 focus-visible:outline-none focus-visible:ring-0">
          <SchedulingProfessionalsTab vm={vm} />
        </TabsContent>

        <TabsContent value="categories" className="m-0 focus-visible:outline-none focus-visible:ring-0">
          <SchedulingCategoriesTab vm={vm} />
        </TabsContent>
      </Tabs>

      <SchedulingDialogs vm={vm} />
    </div>
  );
}
