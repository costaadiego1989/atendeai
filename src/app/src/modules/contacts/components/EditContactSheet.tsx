import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { TagInput } from '@/shared/ui/TagInput';

interface EditContactForm {
  name: string;
  email: string;
  tags: string;
  notes: string;
}

interface EditContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: EditContactForm;
  onFormChange: <K extends keyof EditContactForm>(field: K, value: EditContactForm[K]) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function EditContactSheet({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: EditContactSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[640px] sm:max-w-[640px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar contato</SheetTitle>
          <SheetDescription>
            Ajuste os dados comerciais desse contato sem perder o histórico do
            relacionamento.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-contact-name">Nome</Label>
            <Input
              id="edit-contact-name"
              value={form.name}
              onChange={(event) => onFormChange('name', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-contact-email">Email</Label>
            <Input
              id="edit-contact-email"
              type="email"
              value={form.email}
              onChange={(event) => onFormChange('email', event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="edit-contact-tags">Tags</Label>
            <TagInput
              id="edit-contact-tags"
              tags={form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : []}
              onChange={(tags) => onFormChange('tags', tags.join(', '))}
              placeholder="Ex: VIP, recorrente, indicação"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="edit-contact-notes">Notas</Label>
            <Textarea
              id="edit-contact-notes"
              className="min-h-[140px]"
              value={form.notes}
              onChange={(event) => onFormChange('notes', event.target.value)}
              placeholder="Contexto comercial, preferências e observações importantes."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            Salvar alterações
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
