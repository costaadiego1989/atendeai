import React from 'react';
import type { DateRange } from 'react-day-picker';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type {
  CheckoutCustomRange,
  CheckoutPeriodFilter,
} from '@/modules/checkout/view-models/useCheckoutOrdersViewModel';

interface CheckoutPeriodPickerProps {
  periodFilter: CheckoutPeriodFilter;
  customRange: CheckoutCustomRange;
  periodOptions: Array<{
    value: Exclude<CheckoutPeriodFilter, 'custom'>;
    label: string;
    description: string;
  }>;
  onSelectPreset: (value: Exclude<CheckoutPeriodFilter, 'custom'>) => void;
  onSelectRange: (range: CheckoutCustomRange) => void;
}

function formatRangeLabel(range: CheckoutCustomRange) {
  if (!range.from) return 'Selecionar datas';
  const from = format(range.from, 'dd/MM/yyyy', { locale: ptBR });
  if (!range.to) return from;
  return `${from} — ${format(range.to, 'dd/MM/yyyy', { locale: ptBR })}`;
}

export const CheckoutPeriodPicker: React.FC<CheckoutPeriodPickerProps> = ({
  periodFilter,
  customRange,
  periodOptions,
  onSelectPreset,
  onSelectRange,
}) => {
  const [open, setOpen] = React.useState(false);

  const selectedRange: DateRange | undefined = customRange.from
    ? { from: customRange.from, to: customRange.to ?? undefined }
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2 rounded-xl px-4"
        >
          <CalendarDays className="h-4 w-4 text-primary" />
          {periodFilter === 'custom'
            ? formatRangeLabel(customRange)
            : periodOptions.find((option) => option.value === periodFilter)?.label ?? 'Período'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto rounded-2xl p-3">
        <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-background/60 p-1">
          {periodOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={periodFilter === option.value ? 'default' : 'ghost'}
              className="h-8 rounded-lg px-2 text-xs font-bold"
              onClick={() => {
                onSelectPreset(option.value);
                setOpen(false);
              }}
              title={option.description}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Calendar
          mode="range"
          locale={ptBR}
          selected={selectedRange}
          onSelect={(range) =>
            onSelectRange({ from: range?.from ?? null, to: range?.to ?? null })
          }
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
};
