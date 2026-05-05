import { Mail, MessageSquareText, Phone, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { formatPhone } from '@/shared/lib/masks';
import { formatContactSync } from '../utils/contact-helpers';
import type { ContactDetail } from '@/shared/types';

interface ContactSummaryCardProps {
  contact: ContactDetail;
  onEdit: () => void;
  onDelete: () => void;
  onOpenConversation: () => void;
  isOpeningConversation: boolean;
}

export function ContactSummaryCard({
  contact,
  onEdit,
  onDelete,
  onOpenConversation,
  isOpeningConversation,
}: ContactSummaryCardProps) {
  const tags = contact.tags ?? [];

  return (
    <Card className="glass-card overflow-hidden">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/[0.08] via-primary/[0.04] to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Contato CRM
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              {contact.name}
            </h1>
            <div className="mt-3">
              <StatusBadge status={contact.stage} />
            </div>
          </div>
        </div>
      </div>

      <CardContent className="space-y-5 p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Phone className="h-4 w-4 text-muted-foreground" />
            {formatPhone(contact.phone)}
          </div>
          {contact.email ? (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {contact.email}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Tags
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.length ? (
              tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                Sem tags comerciais
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Notas
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground">
            {contact.notes || 'Nenhuma observação comercial registrada até o momento.'}
          </p>
        </div>

        <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Criado em</span>
            <span className="font-medium text-foreground">
              {formatContactSync(contact.createdAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Última interação</span>
            <span className="font-medium text-foreground">
              {formatContactSync(contact.lastInteraction)}
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          <Button
            className="h-11 w-full rounded-2xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/85"
            onClick={onOpenConversation}
            disabled={isOpeningConversation}
          >
            <MessageSquareText className="mr-2 h-4 w-4" />
            Abrir conversa
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full rounded-2xl border-border/60 bg-background text-foreground hover:border-primary/25 hover:bg-primary/[0.06] hover:text-foreground"
            onClick={onEdit}
          >
            Editar dados
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full rounded-2xl border border-border/60 bg-background text-foreground hover:border-destructive/35 hover:bg-destructive/[0.08] hover:text-foreground"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
            Remover contato
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
