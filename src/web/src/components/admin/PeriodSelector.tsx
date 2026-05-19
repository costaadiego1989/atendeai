import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder="Periodo" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1d">Hoje</SelectItem>
        <SelectItem value="7d">7 dias</SelectItem>
        <SelectItem value="30d">30 dias</SelectItem>
        <SelectItem value="90d">90 dias</SelectItem>
      </SelectContent>
    </Select>
  );
}
