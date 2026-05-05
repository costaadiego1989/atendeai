import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type MultiSelectOption = {
  value: string;
  label: string;
};

interface MultiSelectFilterProps {
  value: string[];
  options: MultiSelectOption[];
  onChange: (value: string[]) => void;
  placeholder: string;
  allLabel?: string;
  className?: string;
}

function buildSummaryLabel(
  selectedValues: string[],
  options: MultiSelectOption[],
  placeholder: string,
  allLabel: string,
) {
  if (selectedValues.length === 0) {
    return allLabel;
  }

  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));
  if (selectedOptions.length === 1) {
    return selectedOptions[0]?.label ?? placeholder;
  }

  return `${selectedOptions.length} selecionados`;
}

export function MultiSelectFilter({
  value,
  options,
  onChange,
  placeholder,
  allLabel = 'Todos',
  className,
}: MultiSelectFilterProps) {
  const selectedValues = value.filter((item) =>
    options.some((option) => option.value === item),
  );

  function toggleValue(nextValue: string) {
    if (selectedValues.includes(nextValue)) {
      onChange(selectedValues.filter((item) => item !== nextValue));
      return;
    }

    onChange([...selectedValues, nextValue]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('h-10 w-full justify-between px-3 font-normal', className)}
        >
          <span className="truncate text-left">
            {buildSummaryLabel(selectedValues, options, placeholder, allLabel)}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="border-b border-border/60 px-3 py-2">
          <p className="text-sm font-medium text-foreground">{placeholder}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => onChange([])}>
              Limpar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => onChange(options.map((option) => option.value))}
            >
              Selecionar todos
            </Button>
          </div>
        </div>

        <div className="max-h-72 overflow-auto py-1">
          {options.map((option) => {
            const checked = selectedValues.includes(option.value);

            return (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-muted/40"
                onClick={() => toggleValue(option.value)}
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="flex-1">{option.label}</span>
                {checked ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            );
          })}
        </div>

        {selectedValues.length > 0 ? (
          <div className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <button
              type="button"
              className="inline-flex items-center gap-1 transition hover:text-foreground"
              onClick={() => onChange([])}
            >
              <X className="h-3.5 w-3.5" />
              Limpar selecao
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
