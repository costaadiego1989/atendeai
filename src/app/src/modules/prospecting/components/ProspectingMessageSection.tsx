import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles } from 'lucide-react';

type ProspectingMessageSectionProps = {
  id: string;
  label?: string;
  description: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSuggest: () => void;
  isSuggesting?: boolean;
};

export function ProspectingMessageSection({
  id,
  label = 'Mensagem base',
  description,
  value,
  placeholder,
  onChange,
  onSuggest,
  isSuggesting = false,
}: ProspectingMessageSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Label htmlFor={id}>{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onSuggest}
          disabled={isSuggesting}
        >
          <Sparkles className="h-4 w-4" />
          {isSuggesting ? 'Gerando...' : 'Gerar com IA'}
        </Button>
      </div>
      <Textarea
        id={id}
        rows={6}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
