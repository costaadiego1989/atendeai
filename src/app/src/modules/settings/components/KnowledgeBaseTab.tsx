import { CardSkeleton } from '@/shared/ui/Skeletons';
import { useKnowledgeBaseViewModel } from '../view-models/useKnowledgeBaseViewModel';
import { DocumentUploadCard } from './DocumentUploadCard';
import { DocumentsList } from './DocumentsList';

export function KnowledgeBaseTab() {
  const vm = useKnowledgeBaseViewModel();

  if (vm.isLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          Documentos enviados aqui alimentam a IA com informações do seu negócio.
          Quanto mais contexto, mais precisa e confiável a resposta.
        </p>
        <DocumentUploadCard onUpload={vm.upload} isUploading={vm.isUploading} />
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">
          Documentos ({vm.documents.length})
        </h3>
        <DocumentsList
          documents={vm.documents}
          onDelete={vm.deleteDoc}
          isDeleting={vm.isDeleting}
        />
      </div>
    </div>
  );
}
