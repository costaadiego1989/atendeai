import { Link } from 'react-router-dom';
import { MessageSquareText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={onToggleAll}
              aria-label="Select all contacts"
            />
          </TableHead>
          <TableHead>Contato</TableHead>
          <TableHead>Estágio</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Última interação</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleContacts.map((contact) => (
          <TableRow
            key={contact.id}
            data-state={selectedContactIds.includes(contact.id) ? 'selected' : undefined}
          >
            <TableCell className="w-12">
              <Checkbox
                checked={selectedContactIds.includes(contact.id)}
                onCheckedChange={() => onToggleSelection(contact.id)}
                aria-label={`Select ${contact.name}`}
              />
            </TableCell>
            <TableCell>
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
            </TableCell>
            <TableCell>
              <StatusBadge status={contact.stage} />
            </TableCell>
            <TableCell>
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
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatContactSync(contact.lastInteraction)}
            </TableCell>
            <TableCell>
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
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
