import { useState } from 'react';
import { ChevronDown, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listAutomationTemplates } from '../templates/automation-templates';
import type { AutomationTemplate } from '../templates/automation-templates';

interface AutomationTemplatePickerProps {
  onSelect: (template: AutomationTemplate) => void;
}

export function AutomationTemplatePicker({ onSelect }: AutomationTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const templates = listAutomationTemplates();

  const handleSelect = (template: AutomationTemplate) => {
    onSelect(template);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <LayoutTemplate className="h-4 w-4" />
        Usar template
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute left-0 z-20 mt-1 w-72 rounded-lg border border-border/60 bg-popover p-1 shadow-md"
          >
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(template)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50"
              >
                <template.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {template.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {template.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
