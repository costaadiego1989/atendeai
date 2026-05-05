import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Option = {
  value: string;
  label: string;
};

type Props = {
  title: string;
  emptyMessage: string;
  options: Option[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function TargetSearchList({
  title,
  emptyMessage,
  options,
  selectedIds,
  onChange,
}: Props) {
  const [search, setSearch] = useState('');
  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedSearch),
    );
  }, [options, search]);

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((item) => item !== id));
  }

  return (
    <section className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-semibold">{title}</Label>
        <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          {selectedIds.length} selecionados
        </span>
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar por nome"
          className="h-9 pl-9"
        />
      </div>

      <div className="mt-3 max-h-56 overflow-y-auto rounded-md border border-border/50 bg-background/50">
        {options.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : filteredOptions.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
        ) : (
          filteredOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 border-b border-border/40 px-3 py-2.5 text-sm last:border-b-0 hover:bg-muted/30"
            >
              <Checkbox
                checked={selectedIds.includes(option.value)}
                onCheckedChange={(checked) => toggle(option.value, Boolean(checked))}
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
            </label>
          ))
        )}
      </div>
    </section>
  );
}
