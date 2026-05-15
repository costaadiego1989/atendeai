import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabsList } from '@/components/PageTabs';
import { Box, CheckCircle2, Download, Filter, Link2 } from 'lucide-react';
import { AsyncOperationsPanel } from '@/shared/ui/AsyncOperationsPanel';
import { useInventoryPageViewModel } from '@/modules/inventory/view-models/useInventoryPageViewModel';
import { InventoryHeader } from '../components/InventoryHeader';
import { InventoryKPIs } from '../components/InventoryKPIs';
import { InventoryItemsTab } from '../components/InventoryItemsTab';
import { InventoryConnectionsTab } from '../components/InventoryConnectionsTab';
import { InventoryReadinessTab } from '../components/InventoryReadinessTab';
import { InventorySnapshotSheet } from '../components/InventorySnapshotSheet';
import { InventoryItemDetailSheet } from '../components/InventoryItemDetailSheet';
import { InventoryReportsSheet } from '../components/InventoryReportsSheet';

export default function InventoryPage() {
  const navigate = useNavigate();
  const vm = useInventoryPageViewModel();
  const allItems = vm.itemsQuery.data ?? [];
  const connections = vm.connectionsQuery.data ?? [];
  const lowOrBlocked = allItems.filter(
    (item) => item.availabilityStatus !== 'AVAILABLE',
  ).length;
  const totalQuantity = allItems.reduce(
    (total, item) => total + item.availableQuantity,
    0,
  );

  return (
    <div className="page-container animate-fade-in">
      <InventoryHeader
        onNewConnection={() => navigate('/app/settings/integrations')}
        onNewSnapshot={() => vm.setSyncDialogOpen(true)}
      />

      <AsyncOperationsPanel
        title="Processamentos em andamento"
        description="Processando em segundo plano — você pode continuar usando normalmente."
        items={vm.activeJobItems}
      />

      <Card className="glass-card border-border/40 bg-background/30 mb-6">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/70">
              <Filter className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Relatório do estoque</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-3 rounded-xl border border-border/60 bg-background/60 p-1">
              {[
                { value: 'ALL', label: 'Todos' },
                { value: 'AVAILABLE', label: 'Disponível' },
                { value: 'LOW_STOCK', label: 'Baixo' },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={vm.statusFilter === option.value ? 'default' : 'ghost'}
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  onClick={() => vm.setStatusFilter(option.value as typeof vm.statusFilter)}
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

      <InventoryKPIs
        itemCount={allItems.length}
        totalQuantity={totalQuantity}
        alertCount={lowOrBlocked}
        connectionCount={connections.length}
      />

      <Tabs defaultValue="items" className="space-y-5">
        <PageTabsList
          tabs={[
            { value: 'items', label: 'Itens', icon: Box },
            { value: 'connections', label: 'Conexões', icon: Link2 },
            { value: 'readiness', label: 'Prontidão', icon: CheckCircle2 },
          ]}
        />

        <TabsContent value="items">
          <InventoryItemsTab
            items={vm.filteredItems}
            isLoading={vm.itemsQuery.isLoading}
            search={vm.search}
            onSearchChange={vm.setSearch}
            statusFilter={vm.statusFilter}
            onStatusFilterChange={vm.setStatusFilter}
            showAvailableOnly={vm.showAvailableOnly}
            onToggleAvailableOnly={() => vm.setShowAvailableOnly(!vm.showAvailableOnly)}
            onSelectItem={vm.setSelectedItem}
            onNewSnapshot={() => vm.setSyncDialogOpen(true)}
            page={vm.page}
            totalPages={vm.totalPages}
            totalItems={vm.totalFilteredItems}
            onPageChange={vm.setPage}
          />
        </TabsContent>

        <TabsContent value="connections">
          <InventoryConnectionsTab
            connections={connections}
            isLoading={vm.connectionsQuery.isLoading}
            onNewConnection={() => navigate('/app/settings/integrations')}
            onSyncConnection={(id, name) => vm.syncConnectionMutation.mutate({ connectionId: id, providerName: name })}
            syncPendingConnectionId={
              vm.syncConnectionMutation.isPending && vm.syncConnectionMutation.variables != null
                ? vm.syncConnectionMutation.variables.connectionId
                : null
            }
            lastSyncResult={vm.lastSyncResult}
          />
        </TabsContent>

        <TabsContent value="readiness">
          <InventoryReadinessTab />
        </TabsContent>
      </Tabs>

      <InventorySnapshotSheet
        open={vm.syncDialogOpen}
        onOpenChange={vm.setSyncDialogOpen}
        form={vm.syncForm}
        onFormChange={vm.setSyncForm}
        onPriceChange={vm.setSyncCurrentPrice}
        onSubmit={() => vm.syncItemMutation.mutate()}
        isPending={vm.syncItemMutation.isPending}
        prefillCatalogItemId={vm.prefillCatalogItemId}
        isEditing={Boolean(vm.syncForm.sku && vm.selectedItem?.sku === vm.syncForm.sku)}
      />

      <InventoryItemDetailSheet
        item={vm.selectedItem}
        onClose={() => vm.setSelectedItem(null)}
        onUpdateSnapshot={() => vm.selectedItem && vm.openUpdateSnapshot(vm.selectedItem)}
      />

      <InventoryReportsSheet vm={vm} />
    </div>
  );
}
