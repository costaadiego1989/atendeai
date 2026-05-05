import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type UserOption = { id: string; name: string; email: string };

export function UserSelectFilter(props: {
  value: string | null;
  onChange: (value: string | null) => void;
  users: UserOption[];
  disabled?: boolean;
}) {
  return (
    <Select
      value={props.value ?? 'ALL'}
      onValueChange={(v) => props.onChange(v === 'ALL' ? null : v)}
      disabled={props.disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Todos os usuários" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">Todos</SelectItem>
        {props.users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name} ({u.email})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

