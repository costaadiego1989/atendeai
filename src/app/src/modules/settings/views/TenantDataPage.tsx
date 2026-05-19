import { Save, User, MapPin, Clock, GitBranch, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { PageSkeleton } from '@/shared/ui/Skeletons';
import { TenantAddressTab } from '@/modules/settings/components/tenant/TenantAddressTab';
import { TenantHoursTab } from '@/modules/settings/components/tenant/TenantHoursTab';
import { TenantBranchesTab } from '@/modules/settings/components/tenant/TenantBranchesTab';
import { TenantIdentityTab } from '@/modules/settings/components/tenant/TenantIdentityTab';
import { TenantMetricsGrid } from '@/modules/settings/components/tenant/TenantMetricsGrid';
import { TenantOnboardingCard } from '@/modules/settings/components/tenant/TenantOnboardingCard';
import { TenantPageHeader } from '@/modules/settings/components/tenant/TenantPageHeader';
import { TenantSupportMeta } from '@/modules/settings/components/tenant/TenantSupportMeta';
import { TenantAuditTab } from '@/modules/settings/components/tenant/TenantAuditTab';
import { useTenantDataViewModel } from '@/modules/settings/view-models/useTenantDataViewModel';

export default function TenantDataPage() {
  const {
    form: { register, watch, setValue },
    isLoading,
    isSaving,
    owner,
    submit,
    tenantId,
    tenantData,
    isBranchScope,
    handleZipcodeChange,
  } = useTenantDataViewModel();

  const planCode = tenantData?.plan?.toUpperCase();
  const hasBranchesAccess = planCode === 'PROFISSIONAL' || planCode === 'ESCALA';

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="page-container animate-fade-in">
      <TenantPageHeader tenantData={tenantData} />

      <TenantOnboardingCard tenantId={tenantId} />

      <TenantMetricsGrid
        tenantData={tenantData}
        owner={owner}
        mondayClosed={Boolean(watch('operatingHours.monday.closed'))}
      />

      <Card className="glass-card border-border/60">
        <TenantSupportMeta tenantData={tenantData} owner={owner} />

        <form onSubmit={submit} className="space-y-6 px-6 pb-6">
          <Tabs defaultValue="identity" className="space-y-6">
            <PageTabsList
              tabs={[
                { value: 'identity', label: 'Identidade', icon: User },
                { value: 'address', label: 'Endereço', icon: MapPin },
                { value: 'hours', label: 'Funcionamento', icon: Clock },
                ...(hasBranchesAccess
                  ? [{ value: 'branches', label: 'Filiais', icon: GitBranch }]
                  : []),
                { value: 'audit', label: 'Auditoria', icon: ShieldCheck },
              ]}
            />

            <TabsContent value="identity">
              <TenantIdentityTab
                register={register}
                watch={watch}
                setValue={setValue}
                owner={owner}
                tenantData={tenantData}
                isBranchScope={isBranchScope}
              />
            </TabsContent>

            <TabsContent value="address">
              <TenantAddressTab
                register={register}
                onZipcodeChange={handleZipcodeChange}
              />
            </TabsContent>

            <TabsContent value="hours">
              <TenantHoursTab register={register} watch={watch} setValue={setValue} />
            </TabsContent>

            {hasBranchesAccess && (
              <TabsContent value="branches">
                <TenantBranchesTab tenantId={tenantId} branches={tenantData?.branches ?? []} />
              </TabsContent>
            )}

            <TabsContent value="audit">
              <TenantAuditTab tenantData={tenantData} />
            </TabsContent>
          </Tabs>

          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Salvar dados da empresa</p>
              <p className="text-xs text-muted-foreground">
                {isBranchScope
                  ? 'Os dados salvos aqui atualizam a filial selecionada no topo.'
                  : 'Os dados salvos aqui serão usados pela própria IA para gerar conteúdo e interagir com os clientes.'}
              </p>
            </div>
            <Button type="submit" className="gap-2" disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
