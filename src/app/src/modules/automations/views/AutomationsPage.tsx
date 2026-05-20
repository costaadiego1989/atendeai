import { useState } from 'react';
import { Plus, Search, Zap } from 'lucide-react';
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
import type { Automation } from '../types';

export default function AutomationsPage() {
  const vm = useAutomationsViewModel();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingAutomation(null);
    setFormOpen(true);
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
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Automações
          </h1>
          <p className="page-description mt-1">
            Crie regras automáticas para mensagens, tags, tarefas e mais.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 w-fit" onClick={handleCreate}>
          <Plus className="h-4 w-4" />
          Nova automação
        </Button>
      </div>

      {/* Search */}
      <div className="glass-card mb-4 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={vm.search}
            onChange={(e) => vm.setSearch(e.target.value)}
            placeholder="Buscar automações..."
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      {vm.isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <AutomationsList
          automations={vm.filteredAutomations}
          onEdit={handleEdit}
          onDelete={(id) => setDeleteId(id)}
          onToggleActive={vm.toggleActive}
          disabled={vm.isMutating}
        />
      )}

      {/* Form Sheet */}
      <AutomationFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        automation={editingAutomation}
        onSubmit={handleFormSubmit}
        isSubmitting={vm.isMutating}
      />

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
