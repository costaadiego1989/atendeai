import { useState } from 'react';
import { Plus, Zap, HelpCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/shared/ui/EmptyState';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CardSkeleton } from '@/shared/ui/Skeletons';
import { useAutomationsViewModel } from '../view-models/useAutomationsViewModel';
import { AutomationsList } from '../components/AutomationsList';
import { AutomationFormSheet } from '../components/AutomationFormSheet';
import { AutomationFilter } from '../components/AutomationFilter';
import { AutomationWizard } from '../components/AutomationWizard';
import { useAutomationSearch } from '../services/automation-search-service';
import { HelpDialog } from '../components/HelpDialog';
import type { Automation } from '../types';
import { TriggerType, TRIGGER_LABELS } from '../types';

export default function AutomationsPage() {
  const vm = useAutomationsViewModel();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Novo hook de busca e filtros
  const search = useAutomationSearch(vm.automations);

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingAutomation(null);
    setFormOpen(true);
  };

  const handleWizardComplete = async (input: Parameters<typeof vm.createAutomation>[0]) => {
    await vm.createAutomation(input);
    setWizardOpen(false);
  };

  const handleFormSubmit = async (input: Parameters<typeof vm.createAutomation>[0]) => {
    if (editingAutomation) {
      await vm.updateAutomation(editingAutomation.id, input);
    } else {
      await vm.createAutomation(input);
    }
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await vm.deleteAutomation(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start justify-between w-full">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Automações
            </h1>
            <p className="page-description mt-1">
              Crie regras automáticas para mensagens, tags, tarefas e mais.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHelpOpen(true)}
              className="gap-1.5"
            >
              <HelpCircle className="h-4 w-4" />
              Ajuda
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => setWizardOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Nova automação
            </Button>
          </div>
        </div>
      </div>

      {/* Advanced Search and Filter */}
      <AutomationFilter
        onFilterChange={search.updateFilter}
        currentFilter={search.currentFilter}
        availableTriggers={Object.values(TriggerType)}
        availableTags={search.availableTags}
        totalCount={search.totalCount}
      />

      {/* Quick actions bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWizardOpen(true)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Criar com wizard
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFormOpen(true)}
          className="gap-1.5"
        >
          <FileText className="h-4 w-4" />
          Criar manual
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHelpOpen(true)}
          className="gap-1.5"
        >
          <HelpCircle className="h-4 w-4" />
          Templates e exemplos
        </Button>
      </div>

      {/* List */}
      {search.isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : search.filteredAutomations.length === 0 ? (
        (() => {
          const hasActiveFilters =
            !!search.currentFilter.search ||
            search.currentFilter.status !== 'all' ||
            search.currentFilter.triggerTypes.length > 0 ||
            search.currentFilter.tags.length > 0;
          return (
            <EmptyState
              icon={Zap}
              title={hasActiveFilters ? 'Nenhum resultado encontrado' : 'Comece criando sua primeira automação'}
              description={
                hasActiveFilters
                  ? 'Tente ajustar seus filtros ou crie uma nova automação.'
                  : 'Automatize tarefas repetitivas para economizar tempo e garantir consistência nas interações com seus clientes.'
              }
              actionLabel={hasActiveFilters ? 'Criar automação' : 'Criar primeira automação'}
              onAction={() => setWizardOpen(true)}
            />
          );
        })()
      ) : (
        <AutomationsList
          automations={search.filteredAutomations}
          onEdit={handleEdit}
          onDelete={(id) => setDeleteId(id)}
          onToggleActive={vm.toggleActive}
          disabled={vm.isMutating}
        />
      )}

      {/* Wizard Dialog */}
      <AutomationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={handleWizardComplete}
        onCancel={() => setWizardOpen(false)}
      />

      {/* Form Sheet */}
      <AutomationFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        automation={editingAutomation}
        onSubmit={handleFormSubmit}
        isSubmitting={vm.isMutating}
      />

      {/* Help Dialog */}
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A automação será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
