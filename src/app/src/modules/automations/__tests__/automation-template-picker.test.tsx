import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutomationTemplatePicker } from '../components/AutomationTemplatePicker';
import { listAutomationTemplates } from '../templates/automation-templates';

describe('AutomationTemplatePicker', () => {
  it('keeps the template list hidden until the trigger is clicked', () => {
    render(<AutomationTemplatePicker onSelect={() => {}} />);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('lists every catalog template when opened', () => {
    render(<AutomationTemplatePicker onSelect={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /usar template/i }));

    expect(screen.getAllByRole('menuitem')).toHaveLength(
      listAutomationTemplates().length,
    );
  });

  it('calls onSelect with the chosen template and closes the menu', () => {
    const onSelect = vi.fn();
    render(<AutomationTemplatePicker onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /usar template/i }));
    const first = listAutomationTemplates()[0];
    fireEvent.click(
      screen.getByRole('menuitem', { name: new RegExp(first.name, 'i') }),
    );

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(first);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
