import { GripVertical } from 'lucide-react';
import { formatPhone } from '@/shared/lib/masks';
import { stageToneMap } from '../utils/contact-helpers';
import type { ContactDetail, ContactStage } from '@/shared/types';

interface StageOption {
  value: ContactStage;
  label: string;
}

interface ContactStageBoardProps {
  contact: ContactDetail;
  stageOptions: StageOption[];
  draggingStage: string | null;
  onDraggingStageChange: (stage: string | null) => void;
  onStageChange: (stage: ContactStage) => void;
}

export function ContactStageBoard({
  contact,
  stageOptions,
  draggingStage,
  onDraggingStageChange,
  onStageChange,
}: ContactStageBoardProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Arraste o contato para outra coluna do funil para atualizar o estágio
          comercial.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        {stageOptions.map((option) => {
          const isActive = contact.stage === option.value;
          const tone = stageToneMap[option.value] ?? stageToneMap.LEAD;
          const isDragging = draggingStage === option.value;

          return (
            <div
              key={option.value}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                onDraggingStageChange(null);
                if (contact.stage !== option.value) {
                  onStageChange(option.value);
                }
              }}
              className={`min-h-[240px] rounded-3xl border p-4 transition-all ${
                isActive
                  ? `${tone.surface} ${tone.ring} ring-2`
                  : 'border-border/60 bg-background'
              } ${isDragging && !isActive ? 'border-primary/40 bg-primary/[0.04]' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Etapa
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-foreground">
                    {option.label}
                  </h3>
                </div>
                {isActive ? (
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tone.text}`}
                  >
                    Atual
                  </span>
                ) : null}
              </div>

              <div className="mt-4">
                {isActive ? (
                  <div
                    draggable
                    onDragStart={() => onDraggingStageChange(option.value)}
                    onDragEnd={() => onDraggingStageChange(null)}
                    className={`cursor-grab rounded-2xl border bg-card/90 p-4 shadow-sm active:cursor-grabbing ${tone.surface}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${tone.dot}`}
                      >
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {contact.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {formatPhone(contact.phone)}
                        </p>
                      </div>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[132px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 px-4 text-center text-sm text-muted-foreground">
                    Solte aqui para mover para {option.label.toLowerCase()}.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
