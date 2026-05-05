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

interface CreateContactForm {
  name: string;
  phone: string;
  document: string;
  email: string;
  tags: string;
  notes: string;
}

interface CreateContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CreateContactForm;
  onFormChange: <K extends keyof CreateContactForm>(field: K, value: CreateContactForm[K]) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function CreateContactSheet({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: CreateContactSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[640px] sm:max-w-[640px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Novo contato no CRM</SheetTitle>
          <SheetDescription>
            Cadastre manualmente um contato para iniciar relacionamento, registrar
            contexto comercial e abrir conversa quando quiser.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Nome</Label>
            <Input
              id="contact-name"
              value={form.name}
              onChange={(event) => onFormChange('name', event.target.value)}
              placeholder="Ex: Maria Oliveira"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone">Telefone</Label>
            <Input
              id="contact-phone"
              value={form.phone}
              onChange={(event) => onFormChange('phone', event.target.value)}
              placeholder="(11) 99999-0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-document">CPF ou CNPJ</Label>
            <Input
              id="contact-document"
              value={form.document}
              onChange={(event) => onFormChange('document', event.target.value)}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={form.email}
              onChange={(event) => onFormChange('email', event.target.value)}
              placeholder="cliente@empresa.com"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="contact-tags">Tags</Label>
            <TagInput
              id="contact-tags"
              tags={form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : []}
              onChange={(tags) => onFormChange('tags', tags.join(', '))}
              placeholder="Ex: VIP, indicação, recorrente"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="contact-notes">Notas comerciais</Label>
            <Textarea
              id="contact-notes"
              value={form.notes}
              onChange={(event) => onFormChange('notes', event.target.value)}
              placeholder="Ex: prefere atendimento à tarde e respondeu bem à oferta premium."
              className="min-h-[110px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            Salvar contato
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
