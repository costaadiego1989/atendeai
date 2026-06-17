import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepConfigFields } from '../components/StepConfigFields';
import { StepType } from '../types';
import type { AutomationStep } from '../types';

function renderStep(
  type: StepType,
  config: Record<string, unknown> = {},
  onConfigChange = vi.fn(),
) {
  const step: Omit<AutomationStep, 'id'> = { type, config, order: 0 };
  render(<StepConfigFields step={step} onConfigChange={onConfigChange} />);
  return onConfigChange;
}

const NOT_IMPLEMENTED = /disponível em breve/i;

describe('StepConfigFields', () => {
  it('renders condition_branch with field, operator and value controls', () => {
    renderStep(StepType.CONDITION_BRANCH, { field: '', operator: 'equals', value: '' });
    expect(screen.queryByText(NOT_IMPLEMENTED)).toBeNull();
    expect(screen.getByPlaceholderText(/campo/i)).toBeInTheDocument();
  });

  it('renders http_request with method and url controls', () => {
    renderStep(StepType.HTTP_REQUEST, { method: 'POST', url: '', headers: {}, body: {} });
    expect(screen.queryByText(NOT_IMPLEMENTED)).toBeNull();
    expect(screen.getByPlaceholderText(/https?:\/\//i)).toBeInTheDocument();
  });

  it('renders update_contact with a fields editor', () => {
    renderStep(StepType.UPDATE_CONTACT, { fields: {} });
    expect(screen.queryByText(NOT_IMPLEMENTED)).toBeNull();
  });

  it('renders assign_agent with agentId input and emits agentId on change', () => {
    const onChange = renderStep(StepType.ASSIGN_AGENT, { agentId: '', teamId: '' });
    expect(screen.queryByText(NOT_IMPLEMENTED)).toBeNull();
    const input = screen.getByPlaceholderText(/agente/i);
    fireEvent.change(input, { target: { value: 'agent-1' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'agent-1' }));
  });

  it('renders ai_response with a prompt editor', () => {
    const onChange = renderStep(StepType.AI_RESPONSE, { prompt: '' });
    expect(screen.queryByText(NOT_IMPLEMENTED)).toBeNull();
    const prompt = screen.getByPlaceholderText(/prompt|instru/i);
    fireEvent.change(prompt, { target: { value: 'responda educadamente' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'responda educadamente' }),
    );
  });

  it('renders create_task and stores due time as dueInMs', () => {
    const onChange = renderStep(StepType.CREATE_TASK, { title: '', dueInMs: 86400000 });
    expect(screen.queryByText(NOT_IMPLEMENTED)).toBeNull();
    const hours = screen.getByLabelText(/prazo/i);
    fireEvent.change(hours, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dueInMs: 2 * 3600000 }),
    );
  });

  it('never shows the "not implemented" placeholder for any StepType', () => {
    for (const type of Object.values(StepType)) {
      const { unmount } = render(
        <StepConfigFields step={{ type, config: {}, order: 0 }} onConfigChange={vi.fn()} />,
      );
      expect(screen.queryByText(NOT_IMPLEMENTED)).toBeNull();
      unmount();
    }
  });
});
