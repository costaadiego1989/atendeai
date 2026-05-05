import React, { KeyboardEvent, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TagInputProps {
  id?: string;
  tags?: string[];
  value?: string;
  onChange: (tags: string[] | string) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  id,
  tags,
  value,
  onChange,
  placeholder = 'Adicione tags...',
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const currentTags = Array.isArray(tags)
    ? tags
    : typeof value === 'string'
      ? value.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [];

  const emitChange = (nextTags: string[]) => {
    if (Array.isArray(tags)) {
      onChange(nextTags);
      return;
    }

    onChange(nextTags.join(', '));
  };

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().replace(/,$/, '');
    if (trimmedTag && !currentTags.includes(trimmedTag)) {
      emitChange([...currentTags, trimmedTag]);
    }
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    emitChange(currentTags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && currentTags.length > 0) {
      removeTag(currentTags[currentTags.length - 1]);
    }
  };

  return (
    <div
      className={cn(
        'group flex min-h-[42px] w-full flex-wrap gap-2 rounded-xl border border-input bg-muted/10 p-2 transition-all focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20',
        className
      )}
    >
      {currentTags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="flex items-center gap-1.5 rounded-lg border-primary/10 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="rounded-full p-0.5 hover:bg-primary/20"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        type="text"
        id={id}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(inputValue)}
        placeholder={currentTags.length === 0 ? placeholder : ''}
        className="flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
