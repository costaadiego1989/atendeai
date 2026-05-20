import { useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DocumentUploadCardProps {
  onUpload: (file: File, title?: string) => Promise<unknown>;
  isUploading: boolean;
}

export function DocumentUploadCard({ onUpload, isUploading }: DocumentUploadCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !title) {
      setTitle(file.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    await onUpload(selectedFile, title || undefined);
    setSelectedFile(null);
    setTitle('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Enviar documento</p>
          <p className="text-xs text-muted-foreground">
            PDF ou TXT. O conteúdo será processado e indexado para a IA.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Arquivo</Label>
          <Input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md"
            onChange={handleFileChange}
            className="text-xs"
          />
        </div>

        {selectedFile && (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-foreground truncate">{selectedFile.name}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {(selectedFile.size / 1024).toFixed(0)} KB
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Título (opcional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome do documento"
                className="text-xs"
              />
            </div>

            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSubmit}
              disabled={isUploading}
            >
              <Upload className="h-3.5 w-3.5" />
              {isUploading ? 'Enviando...' : 'Enviar'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
