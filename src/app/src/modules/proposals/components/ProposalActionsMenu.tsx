import { CalendarClock, Download, Eye, MoreHorizontal, Pencil, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ProposalRecord } from '../types';

type Props = {
  proposal: ProposalRecord;
  onOpen?: (proposal: ProposalRecord) => void;
  onEdit: (proposal: ProposalRecord) => void;
  onGeneratePdf: (proposal: ProposalRecord) => void;
  onSend: (proposal: ProposalRecord) => void;
  onSchedule: (proposal: ProposalRecord) => void;
  onDelete: (proposal: ProposalRecord) => void;
};

export function ProposalActionsMenu({
  proposal,
  onOpen,
  onEdit,
  onGeneratePdf,
  onSend,
  onSchedule,
  onDelete,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full border border-border/60 bg-background/80 shadow-sm hover:bg-muted/60"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Abrir ações da proposta</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {onOpen ? (
          <DropdownMenuItem onSelect={() => onOpen(proposal)} className="gap-2">
            <Eye className="h-4 w-4" />
            Abrir
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => onEdit(proposal)} className="gap-2">
          <Pencil className="h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onGeneratePdf(proposal)} className="gap-2">
          <Download className="h-4 w-4" />
          Baixar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSend(proposal)} className="gap-2">
          <Send className="h-4 w-4" />
          Enviar na conversa
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSchedule(proposal)} className="gap-2">
          <CalendarClock className="h-4 w-4" />
          Agendar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onDelete(proposal)}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
