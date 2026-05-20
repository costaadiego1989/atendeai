import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';

interface WidgetEmbedSnippetProps {
  snippet: string;
}

export function WidgetEmbedSnippet({ snippet }: WidgetEmbedSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!snippet) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
        <p className="text-xs text-muted-foreground">
          O snippet de embed estará disponível após salvar a configuração do widget.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Código de instalação</p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-600" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </>
          )}
        </Button>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
        <code className="block whitespace-pre-wrap break-all text-xs text-foreground/80 font-mono">
          {snippet}
        </code>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Cole esse código antes do {'</body>'} no HTML do seu site. O widget aparecerá automaticamente.
      </p>
    </div>
  );
}
