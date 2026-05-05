import { Blocks, CheckCircle2, Plus } from 'lucide-react';
import { PageTabsList } from '@/components/PageTabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { formatDate } from '@/shared/lib/formatters';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useIntegrationsSettingsViewModel } from '../view-models/useIntegrationsSettingsViewModel';

export function IntegrationsSettingsPage() {
  const vm = useIntegrationsSettingsViewModel();
  const activeConnectionsCount = vm.connectionsQuery.data?.length ?? 0;

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div className="page-header">
        <h1 className="page-title">Integrações globais</h1>
        <p className="page-description">
          Conecte o AtendeAi aos seus ERPs, e-commerces e marketplaces para manter dados centralizados.
        </p>
      </div>

      <Tabs value={vm.activeTab} onValueChange={vm.setActiveTab} className="w-full">
        <PageTabsList
          tabs={[
            { value: 'catalog', label: 'Catalogo de apps', icon: Blocks },
            {
              value: 'active',
              label: `Conexoes ativas ${activeConnectionsCount > 0 ? `(${activeConnectionsCount})` : ''}`,
              icon: CheckCircle2,
            },
          ]}
          className="mb-4"
        />

        <TabsContent value="catalog" className="space-y-4 outline-none">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {vm.SUPPORTED_PROVIDERS.map((provider) => (
              <Card
                key={provider.sourceType}
                className="group relative cursor-pointer overflow-hidden border-border/40 bg-card transition-all outline-none hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                onClick={() => vm.openProviderModal(provider)}
                tabIndex={0}
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary transition-transform group-hover:scale-110">
                    {provider.logo}
                  </div>
                  <h3 className="mb-1 font-semibold text-foreground">{provider.providerName}</h3>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {provider.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      App parceiro
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full group-hover:bg-primary group-hover:text-primary-foreground"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="active" className="space-y-4 outline-none">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vm.connectionsQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando Integrações...</div>
            ) : vm.connectionsQuery.data?.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-border/60 bg-background/30 px-4">
                <EmptyState
                  icon={Blocks}
                  title="Nenhuma integração ativa ainda"
                  description="Conecte seu primeiro ERP, e-commerce ou marketplace para começar a sincronizar catalogo e estoque."
                  actionLabel="Ir para o catalogo"
                  onAction={() => vm.setActiveTab('catalog')}
                />
              </div>
            ) : (
              vm.connectionsQuery.data.map((conn) => (
                <Card key={conn.id} className="glass-card">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                          {vm.SUPPORTED_PROVIDERS.find((provider) => provider.sourceType === conn.sourceType)?.logo || 'A'}
                        </div>
                        {conn.providerName}
                      </CardTitle>
                      <StatusBadge status={conn.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5 pt-0">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Ultima sincronização
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {conn.lastSyncedAt ? formatDate(String(conn.lastSyncedAt)) : 'Aguardando 1o sync'}
                      </p>
                    </div>
                    {conn.configSummary ? (
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                          Identificador
                        </p>
                        <p className="text-sm text-foreground">{conn.configSummary}</p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!vm.selectedProvider} onOpenChange={(open) => !open && vm.closeModal()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Blocks className="h-5 w-5 text-primary" />
              Conectar {vm.selectedProvider?.providerName}
            </DialogTitle>
            <DialogDescription>
              Insira as credenciais de API da sua conta. Elas serao validadas e armazenadas de forma segura.
            </DialogDescription>
          </DialogHeader>

          {vm.selectedProvider ? (
            <div className="space-y-4 py-4">
              {vm.selectedProvider.fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <Input
                    id={field.name}
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={vm.configForm[field.name] || ''}
                    onChange={(event) => vm.handleConfigChange(field.name, event.target.value)}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={vm.closeModal} disabled={vm.isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={vm.submitConnection} disabled={vm.isSubmitting}>
              {vm.isSubmitting ? 'Testando conexao...' : 'Conectar aplicativo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
