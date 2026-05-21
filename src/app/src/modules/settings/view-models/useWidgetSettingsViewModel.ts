import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import { toast } from '@/components/ui/use-toast';
import { widgetService, type WidgetConfig, type UpdateWidgetConfigInput } from '../services/widget-service';

const QUERY_KEY = 'widget-config';

export function useWidgetSettingsViewModel() {
  const queryClient = useQueryClient();
  const tenant = useAuthStore((s) => s.tenant);
  const tenantId = tenant?.id;

  const { data: config, isLoading } = useQuery<WidgetConfig>({
    queryKey: [QUERY_KEY, tenantId],
    queryFn: () => widgetService.getConfig(tenantId!),
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: (input: UpdateWidgetConfigInput) =>
      widgetService.updateConfig(tenantId!, input),
    onSuccess: () => {
      toast({ title: 'Widget salvo', description: 'Configuração atualizada com sucesso.' });
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
    onError: () => {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a configuração do widget.',
        variant: 'destructive',
      });
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => widgetService.uploadAvatar(tenantId!, file),
    onSuccess: () => {
      toast({ title: 'Avatar atualizado', description: 'Imagem do agente salva com sucesso.' });
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
    onError: () => {
      toast({
        title: 'Erro ao enviar imagem',
        description: 'Não foi possível fazer upload do avatar.',
        variant: 'destructive',
      });
    },
  });

  const embedSnippet = useMemo(() => {
    if (!config?.publicToken) return '';
    const origin = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    return `<script src="${origin}/widget.js" data-token="${config.publicToken}" async></script>`;
  }, [config?.publicToken]);

  return {
    config: config ?? null,
    isLoading,
    isSaving: saveMutation.isPending,
    isUploadingAvatar: avatarMutation.isPending,
    embedSnippet,
    saveConfig: (input: UpdateWidgetConfigInput) => saveMutation.mutateAsync(input),
    uploadAvatar: (file: File) => avatarMutation.mutateAsync(file),
  };
}
