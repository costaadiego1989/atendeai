import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Contact2, Download, Filter } from 'lucide-react';
import { EmptyState } from '@/shared/ui/EmptyState';
import { AppPagination } from '@/shared/ui/AppPagination';
import { AsyncOperationsPanel } from '@/shared/ui/AsyncOperationsPanel';
import { TableSkeleton } from '@/shared/ui/Skeletons';
import { useContactsListViewModel } from '@/modules/contacts/view-models/useContactsListViewModel';
import { ContactsHeader } from '../components/ContactsHeader';
import { ContactsKPIs } from '../components/ContactsKPIs';
import { ContactsFilters } from '../components/ContactsFilters';
import { ContactsBulkActionsBar } from '../components/ContactsBulkActionsBar';
import { ContactsTable } from '../components/ContactsTable';
import { CreateContactSheet } from '../components/CreateContactSheet';
import { ContactReportsSheet } from '../components/ContactReportsSheet';
import { ImportContactsSheet } from '../components/ImportContactsSheet';

export default function ContactsListPage() {
  const vm = useContactsListViewModel();

  return (
    <div className="page-container animate-fade-in">
      <ContactsHeader
        onNewContact={() => vm.setCreateOpen(true)}
        onOpenImport={() => vm.setImportOpen(true)}
      />

      <AsyncOperationsPanel
        title="Processamentos em andamento"
        description="Processando em segundo plano — você pode continuar usando normalmente."
        items={vm.activeJobItems}
      />

      <Card className="border-border/40 bg-background/30 mb-6">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/70">
              <Filter className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Relatório de contatos</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-3 rounded-xl border border-border/60 bg-background/60 p-1">
              {vm.periodOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={vm.periodFilter === option.value ? 'default' : 'ghost'}
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  onClick={() => vm.setPeriodFilter(option.value)}
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

      <ContactsKPIs
        total={vm.stats.total}
        pipeline={vm.stats.pipeline}
        customers={vm.stats.customers}
        inactive={vm.stats.inactive}
      />

      <div className="space-y-4">
        <ContactsFilters
          search={vm.search}
          onSearchChange={vm.updateSearch}
          stageFilter={vm.stageFilter}
          onStageFilterChange={vm.updateStageFilter}
          stageOptions={vm.stageFilterOptions}
          totalCount={vm.totalFiltered}
          onClearFilters={vm.clearFilters}
          hasActiveFilters={vm.hasActiveFilters}
        />

        <Card className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border/40 bg-muted/20">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
              Base de contatos
            </h2>
          </div>
          {vm.contactsQuery.isLoading ? (
            <div className="p-6">
              <TableSkeleton cols={5} />
            </div>
          ) : !vm.contacts.length ? (
            <div className="p-12">
              <EmptyState
                icon={Contact2}
                title="Nenhum contato encontrado"
                description="Cadastre novos contatos ou ajuste os filtros para encontrar oportunidades."
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="px-4 pt-4">
                <ContactsBulkActionsBar
                  selectedCount={vm.selectedContactsCount}
                  busy={vm.bulkActionsBusy}
                  stageOptions={vm.stageFilterOptions}
                  onApplyStage={vm.bulkUpdateStage}
                  onAddTag={vm.bulkAddTag}
                  onRemoveTag={vm.bulkRemoveTag}
                  onDelete={vm.bulkDeleteSelected}
                  onClear={vm.clearSelection}
                />
              </div>

              <ContactsTable
                contacts={vm.contacts}
                onOpenConversation={vm.openConversation}
                openingConversationId={vm.openingConversationId}
                selectedContactIds={vm.selectedContactIds}
                onToggleSelection={vm.toggleContactSelection}
                onToggleAll={() =>
                  vm.selectedContactIds.length === vm.contacts.length
                    ? vm.clearSelection()
                    : vm.selectAllContacts(vm.contacts.map((c) => c.id))
                }
              />

              <div className="p-4">
                <AppPagination
                  page={vm.page}
                  totalPages={vm.totalPages}
                  totalItems={vm.totalFiltered}
                  currentItemsCount={vm.contacts.length}
                  itemLabel="contatos nesta busca"
                  onPageChange={vm.setPage}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      <CreateContactSheet
        open={vm.createOpen}
        onOpenChange={vm.setCreateOpen}
        form={vm.createForm}
        onFormChange={vm.updateCreateForm}
        onSubmit={vm.submitCreate}
        isPending={vm.createContactMutation.isPending}
      />

      <ImportContactsSheet
        open={vm.importOpen}
        onOpenChange={vm.setImportOpen}
        form={vm.importForm}
        previewCount={vm.importPreviewCount}
        result={vm.lastImportResult}
        activeJob={vm.latestImportJob}
        isPending={vm.importContactsMutation.isPending}
        onFormChange={vm.updateImportForm}
        onSubmit={vm.submitImport}
      />

      <ContactReportsSheet
        open={vm.reportsOpen}
        onOpenChange={vm.setReportsOpen}
        filters={vm.reportFilters}
        activeJob={vm.latestReportJob}
        isPending={vm.reportMutation.isPending}
        onFilterChange={vm.updateReportFilter}
        onDownloadCsv={vm.downloadReport}
      />
    </div>
  );
}
