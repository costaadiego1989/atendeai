import { Link } from 'react-router-dom';
import { MessageSquareText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { formatPhone } from '@/shared/lib/masks';
import { formatContactSync } from '../utils/contact-helpers';
import type { Contact } from '@/shared/types';

interface ContactsTableProps {
  contacts?: Contact[];
  onOpenConversation: (contactId: string) => void;
  openingConversationId: string | null;
  selectedContactIds: string[];
  onToggleSelection: (contactId: string) => void;
  onToggleAll: () => void;
}

export function ContactsTable({
  contacts,
  onOpenConversation,
  openingConversationId,
  selectedContactIds,
  onToggleSelection,
  onToggleAll,
}: ContactsTableProps) {
  const visibleContacts = contacts ?? [];
  const allSelected = visibleContacts.length > 0 && selectedContactIds.length === visibleContacts.length;
  const someSelected = selectedContactIds.length > 0 && selectedContactIds.length < visibleContacts.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead>
          <tr className="border-b border-border/70">
            <th className="px-4 py-3 text-left w-12">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={onToggleAll}
                aria-label="Select all contacts"
              />
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Contato
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Estágio
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Tags
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Última interação
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleContacts.map((contact) => (
            <tr
              key={contact.id}
              className={`border-b border-border/50 last:border-0 transition-colors hover:bg-muted/20 ${selectedContactIds.includes(contact.id) ? 'bg-primary/5' : ''}`}
            >
              <td className="px-4 py-4 w-12">
                <Checkbox
                  checked={selectedContactIds.includes(contact.id)}
                  onCheckedChange={() => onToggleSelection(contact.id)}
                  aria-label={`Select ${contact.name}`}
                />
              </td>
              <td className="px-4 py-4">
                <div className="space-y-1">
                  <Link
                    to={`/app/contacts/${contact.id}`}
                    className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {contact.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {formatPhone(contact.phone)}
                    {contact.email ? (
                      <span className="ml-2">• {contact.email}</span>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={contact.stage} />
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-1.5">
                  {(contact.tags ?? []).length ? (
                    (contact.tags ?? []).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Sem tags
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-4 text-sm text-muted-foreground">
                {formatContactSync(contact.lastInteraction)}
              </td>
              <td className="px-4 py-4">
                <div className="flex justify-end gap-2">
                  <Button asChild size="sm" variant="outline" className="rounded-xl">
                    <Link to={`/app/contacts/${contact.id}`}>Ver detalhes</Link>
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl"
                    onClick={() => onOpenConversation(contact.id)}
                    disabled={openingConversationId === contact.id}
                  >
                    <MessageSquareText className="mr-2 h-4 w-4" />
                    Conversar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
