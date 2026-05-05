import { MessageSquare } from 'lucide-react';
import { EmptyState } from '@/shared/ui/EmptyState';
import {
  formatContactSync,
  describeTimelineEntry,
  timelineIcons,
} from '../utils/contact-helpers';
import type { ContactTimelineEntry } from '@/shared/types';

interface ContactTimelineProps {
  entries?: ContactTimelineEntry[];
}

export function ContactTimeline({ entries }: ContactTimelineProps) {
  const timelineEntries = entries ?? [];

  if (!timelineEntries.length) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Sem histórico ainda"
        description="Quando houver mensagens, mudanças de estágio ou follow-ups, o CRM vai registrar tudo aqui."
      />
    );
  }

  return (
    <div className="relative pl-10">
      <div className="absolute bottom-0 left-[15px] top-0 w-px bg-border" />
      {timelineEntries.map((entry, index) => {
        const Icon =
          timelineIcons[entry.type as keyof typeof timelineIcons] || MessageSquare;

        return (
          <div
            key={`${entry.type}-${entry.timestamp}-${index}`}
            className="relative mb-6 last:mb-0"
          >
            <div className="absolute left-[-40px] top-2 flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 shadow-sm">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {entry.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {describeTimelineEntry(entry)}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatContactSync(entry.timestamp)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
