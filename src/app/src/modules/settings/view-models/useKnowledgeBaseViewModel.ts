import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import { toast } from '@/components/ui/use-toast';
import { knowledgeBaseService, type TenantDocument } from '../services/knowledge-base-service';

const QUERY_KEY = 'knowledge-base-documents';

export function useKnowledgeBaseViewModel() {
  const queryClient = useQueryClient();
  const tenant = useAuthStore((s) => s.tenant);
  const tenantId = tenant?.id;

  const { data: documents = [], isLoading } = useQuery<TenantDocument[]>({
    queryKey: [QUERY_KEY, tenantId],
    queryFn: () => knowledgeBaseService.listDocuments(tenantId!),
    enabled: !!tenantId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });

  const uploadMutation = useMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) =>
      knowledgeBaseService.uploadDocument(tenantId!, file, title),
    onSuccess: () => {
      toast({ title: 'Documento enviado', description: 'O documento está sendo processado.' });
      void invalidate();
    },
    onError: (error: unknown) => {
      const description =
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível enviar o documento.';
      toast({
        title: 'Erro no upload',
        description,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) =>
      knowledgeBaseService.deleteDocument(tenantId!, documentId),
    onSuccess: () => {
      toast({ title: 'Documento removido', description: 'O documento foi excluído da base.' });
      void invalidate();
    },
    onError: () => {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o documento.',
        variant: 'destructive',
      });
    },
  });

  return {
    documents,
    isLoading,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
    upload: (file: File, title?: string) => uploadMutation.mutateAsync({ file, title }),
    deleteDoc: (documentId: string) => deleteMutation.mutateAsync(documentId),
  };
}
