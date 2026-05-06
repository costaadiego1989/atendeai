import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProposalActionsDialogs } from '@/modules/proposals/components/ProposalActionsDialogs';
import { ProposalDetailPanel } from '@/modules/proposals/components/ProposalDetailPanel';
import { ProposalEditorSheet } from '@/modules/proposals/components/ProposalEditorSheet';
import { ProposalList } from '@/modules/proposals/components/ProposalList';
import { ProposalsHeader } from '@/modules/proposals/components/ProposalsHeader';
import { ProposalsKPIs } from '@/modules/proposals/components/ProposalsKPIs';
import { useProposalsPageViewModel } from '@/modules/proposals/view-models/useProposalsPageViewModel';

export default function ProposalsPage() {
  const vm = useProposalsPageViewModel();

  return (
    <div className="page-container animate-fade-in space-y-6">
      <ProposalsHeader onNewProposal={vm.openCreateEditor} />

      <ProposalsKPIs
        total={vm.summary.total}
        draft={vm.summary.draft}
        scheduled={vm.summary.scheduled}
        sent={vm.summary.sent}
        totalValue={vm.summary.totalValue}
      />

      <Card className="glass-card border-border/40 bg-background/30">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/70">
              <Search className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Filtro de propostas</p>
              <p className="text-xs text-muted-foreground">
                Busque por título, contato, descrição ou status sem sair do layout atual.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={vm.search}
                onChange={(event) => vm.setSearch(event.target.value)}
                placeholder="Buscar propostas..."
              />
            </div>

            <Select value={vm.statusFilter} onValueChange={vm.setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {vm.statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={vm.resetFilters} disabled={!vm.hasFilters}>
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card className="glass-card overflow-hidden">
          <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
              Lista de propostas
            </h2>
          </div>
          <div className="p-4">
            <ProposalList
              items={vm.filteredProposals}
              selectedId={vm.selectedProposalId}
              isLoading={vm.proposalsQuery.isLoading}
              isError={vm.proposalsQuery.isError}
              contactNameMap={vm.contactLabelMap}
              onSelect={vm.selectProposal}
              onEdit={vm.openEditEditor}
              onGeneratePdf={vm.generatePdf}
              onSchedule={vm.scheduleProposal}
              onDelete={vm.requestDelete}
            />
          </div>
        </Card>

        <ProposalDetailPanel
          proposal={vm.selectedProposal}
          contactNameMap={vm.contactLabelMap}
          onEdit={vm.openEditEditor}
          onGeneratePdf={vm.generatePdf}
          onSchedule={vm.scheduleProposal}
          onDelete={vm.requestDelete}
        />
      </div>

      <ProposalEditorSheet
        open={vm.editorOpen}
        mode={vm.editorMode}
        form={vm.editorForm}
        contacts={vm.contacts}
        contactLabelMap={vm.contactLabelMap}
        isPending={vm.createMutation.isPending || vm.updateMutation.isPending}
        currentUserName={vm.user?.name}
        onOpenChange={(open) => {
          if (!open) {
            vm.closeEditor();
          }
        }}
        onFieldChange={vm.setEditorField}
        onItemChange={vm.updateEditorItem}
        onAddItem={vm.addEditorItem}
        onRemoveItem={vm.removeEditorItem}
        onSubmit={vm.submitEditor}
      />

      <ProposalActionsDialogs
        scheduleTarget={vm.scheduleTarget}
        scheduleAt={vm.scheduleAt}
        isSchedulePending={vm.scheduleMutation.isPending}
        deleteTarget={vm.deleteTarget}
        isDeletePending={vm.deleteMutation.isPending}
        onScheduleAtChange={vm.setScheduleAt}
        onCloseSchedule={() => vm.setScheduleTarget(null)}
        onConfirmSchedule={vm.confirmSchedule}
        onCloseDelete={() => vm.setDeleteTarget(null)}
        onConfirmDelete={vm.confirmDelete}
      />
    </div>
  );
}
