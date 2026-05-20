import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import { toast } from '@/components/ui/use-toast';
import { automationService } from '../services/automation-service';
import type { Automation, CreateAutomationInput, UpdateAutomationInput } from '../types';

const QUERY_KEY = 'automations';

export function useAutomationsViewModel() {
  const queryClient = useQueryClient();
  const tenant = useAuthStore((s) => s.tenant);
  const tenantId = tenant?.id;

  const [search, setSearch] = useState('');

  const { data: automations = [], isLoading } = useQuery<Automation[]>({
    queryKey: [QUERY_KEY, tenantId],
    queryFn: () => automationService.list(tenantId!),
    enabled: !!tenantId,
  });

  const filteredAutomations = useMemo(() => {
    if (!search.trim()) return automations;
    const term = search.toLowerCase();
    return automations.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        a.description?.toLowerCase().includes(term),
    );
  }, [automations, search]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });

  const createMutation = useMutation({
    mutationFn: (input: CreateAutomationInput) =>
      automationService.create(tenantId!, input),
    onSuccess: () => {
      toast({ title: 'Automação criada', description: 'A automação foi criada com sucesso.' });
      void invalidate();
    },
    onError: () => {
      toast({ title: 'Erro ao criar', description: 'Não foi possível criar a automação.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAutomationInput }) =>
      automationService.update(tenantId!, id, input),
    onSuccess: () => {
      toast({ title: 'Automação atualizada', description: 'Alterações salvas.' });
      void invalidate();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar', description: 'Não foi possível salvar.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => automationService.remove(tenantId!, id),
    onSuccess: () => {
      toast({ title: 'Automação excluída', description: 'A automação foi removida.' });
      void invalidate();
    },
    onError: () => {
      toast({ title: 'Erro ao excluir', description: 'Não foi possível remover.', variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, currentlyActive }: { id: string; currentlyActive: boolean }) =>
      currentlyActive
        ? automationService.deactivate(tenantId!, id)
        : automationService.activate(tenantId!, id),
    onSuccess: (_data, { currentlyActive }) => {
      toast({
        title: currentlyActive ? 'Automação desativada' : 'Automação ativada',
      });
      void invalidate();
    },
    onError: () => {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' });
    },
  });

  return {
    automations,
    filteredAutomations,
    isLoading,
    search,
    setSearch,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      toggleMutation.isPending,

    createAutomation: (input: CreateAutomationInput) => createMutation.mutateAsync(input),
    updateAutomation: (id: string, input: UpdateAutomationInput) =>
      updateMutation.mutateAsync({ id, input }),
    deleteAutomation: (id: string) => deleteMutation.mutateAsync(id),
    toggleActive: (id: string, currentlyActive: boolean) =>
      toggleMutation.mutateAsync({ id, currentlyActive }),
  };
}
