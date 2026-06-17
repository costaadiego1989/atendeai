import { describe, it, expect } from 'vitest';
import {
  automationTemplates,
  listAutomationTemplates,
  getAutomationTemplate,
  instantiateAutomationTemplate,
  UnknownAutomationTemplateError,
} from '../templates/automation-templates';
import { TriggerType, StepType } from '../types';

describe('automation-templates catalog', () => {
  it('lists all templates as the single source of truth', () => {
    expect(listAutomationTemplates()).toBe(automationTemplates);
    expect(automationTemplates.length).toBeGreaterThan(0);
  });

  it('every template has the required shape', () => {
    for (const t of automationTemplates) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.automation.steps?.length).toBeGreaterThan(0);
    }
  });

  it('exposes unique template ids', () => {
    const ids = automationTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gets a template by id', () => {
    const t = getAutomationTemplate('welcome-sequence');
    expect(t.id).toBe('welcome-sequence');
  });

  it('throws UnknownAutomationTemplateError on unknown id', () => {
    expect(() => getAutomationTemplate('does-not-exist')).toThrow(
      UnknownAutomationTemplateError,
    );
  });
});

describe('instantiateAutomationTemplate (AI/automated entry point)', () => {
  it('returns a valid CreateAutomationInput for every template', () => {
    for (const t of automationTemplates) {
      const input = instantiateAutomationTemplate(t.id);

      expect(input.name).toBeTruthy();
      expect(Object.values(TriggerType)).toContain(input.trigger.type);
      expect(input.steps.length).toBeGreaterThan(0);

      input.steps.forEach((step, index) => {
        expect(Object.values(StepType)).toContain(step.type);
        expect(step.order).toBe(index);
        expect(step).not.toHaveProperty('id');
      });
    }
  });

  it('deep-clones config so callers cannot mutate the catalog', () => {
    const input = instantiateAutomationTemplate('welcome-sequence');
    const tpl = getAutomationTemplate('welcome-sequence');

    (input.steps[0].config as Record<string, unknown>).body = 'MUTATED';

    const original = tpl.automation.steps?.[0].config as Record<string, unknown>;
    expect(original.body).not.toBe('MUTATED');
  });

  it('is deterministic (stable output across calls)', () => {
    const a = instantiateAutomationTemplate('payment-reminder');
    const b = instantiateAutomationTemplate('payment-reminder');
    expect(a).toEqual(b);
  });

  it('throws UnknownAutomationTemplateError on unknown id', () => {
    expect(() => instantiateAutomationTemplate('nope')).toThrow(
      UnknownAutomationTemplateError,
    );
  });
});
