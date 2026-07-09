interface Props {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  disabled?: boolean;
}

export function DashboardChatSuggestions({ suggestions, onPick, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2 border-t bg-muted/20 p-3">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          disabled={disabled}
          className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
