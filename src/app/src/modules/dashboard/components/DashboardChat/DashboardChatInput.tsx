import { useState, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onCancel: () => void;
  isStreaming: boolean;
}

export function DashboardChatInput({ value, onChange, onSend, onCancel, isStreaming }: Props) {
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim() && !isStreaming) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex gap-2 border-t p-3">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Pergunte algo sobre seu negócio..."
        disabled={isStreaming}
      />
      {isStreaming ? (
        <Button variant="outline" size="icon" onClick={onCancel} aria-label="Cancelar">
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="icon" onClick={onSend} disabled={!value.trim()} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
