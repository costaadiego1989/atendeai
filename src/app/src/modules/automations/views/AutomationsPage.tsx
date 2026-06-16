import { useState } from 'react';
import { Plus, Zap, HelpCircle, BookOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

      {/* Welcome card for new users */}
      {vm.automations.length === 0 && (
        <div className="glass-card mb-6 p-6 border border-blue-200 bg-blue-50">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900">
                Comece criando sua primeira automação
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                As automações ajudam a automatizar tarefas repetitivas, economizando tempo e 
                garantindo consistência nas interações com seus clientes.
              </p>
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={() => setWizardOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira automação
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setHelpOpen(true)}
                >
                  Ver exemplos
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className="text-center py-12">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {search.currentFilter.search || search.currentFilter.status !== 'all' || 
             search.currentFilter.triggerTypes.length > 0 || search.currentFilter.tags.length > 0
              ? 'Nenhum resultado encontrado'
              : 'Nenhuma automação criada'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {search.currentFilter.search || search.currentFilter.status !== 'all' || 
             search.currentFilter.triggerTypes.length > 0 || search.currentFilter.tags.length > 0
              ? 'Tente ajustar seus filtros ou criar uma nova automação'
              : 'Crie sua primeira automação para começar a automatizar seus processos'}
          </p>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar automação
          </Button>
        </div>
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
