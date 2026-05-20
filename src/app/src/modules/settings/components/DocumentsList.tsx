import { FileText, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { TenantDocument } from '../services/knowledge-base-service';

interface DocumentsListProps {
  documents: TenantDocument[];
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  PROCESSED: { label: 'Processado', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  PROCESSING: { label: 'Processando', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  PENDING: { label: 'Pendente', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400' },
  FAILED: { label: 'Falhou', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

export function DocumentsList({ documents, onDelete, isDeleting }: DocumentsListProps) {
  if (!documents.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhum documento na base de conhecimento.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Envie PDFs ou TXTs para a IA responder com mais precisão.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const status = STATUS_MAP[doc.status] ?? STATUS_MAP.PENDING;

        return (
          <div
            key={doc.id}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-3 transition-colors hover:bg-muted/20"
          >
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className={`text-[10px] ${status.className}`}>
                  {status.label}
                </Badge>
                {doc.chunksCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {doc.chunksCount} chunks
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {doc.sourceType}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(doc.id)}
              disabled={isDeleting}
              aria-label={`Excluir ${doc.title}`}
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
