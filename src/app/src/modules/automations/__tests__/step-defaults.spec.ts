import { describe, it, expect } from 'vitest';
import { getDefaultStepConfig } from '../utils/step-defaults';
import { StepType } from '../types';

describe('getDefaultStepConfig', () => {
  it('returns send_message defaults', () => {
    expect(getDefaultStepConfig(StepType.SEND_MESSAGE)).toEqual({
      channel: 'whatsapp',
      body: '',
    });
  });

  it('returns wait_delay defaults', () => {
    expect(getDefaultStepConfig(StepType.WAIT_DELAY)).toEqual({
      delayHuman: '1h',
      delayMs: 3600000,
    });
  });

  it('returns condition_branch defaults', () => {
    expect(getDefaultStepConfig(StepType.CONDITION_BRANCH)).toEqual({
      field: '',
      operator: 'equals',
      value: '',
    });
  });

  it('returns http_request defaults', () => {
    expect(getDefaultStepConfig(StepType.HTTP_REQUEST)).toEqual({
      method: 'POST',
      url: '',
      headers: {},
      body: {},
    });
  });

  it('returns update_contact defaults', () => {
    expect(getDefaultStepConfig(StepType.UPDATE_CONTACT)).toEqual({ fields: {} });
  });

  it('returns add_tag / remove_tag defaults', () => {
    expect(getDefaultStepConfig(StepType.ADD_TAG)).toEqual({ tag: '' });
    expect(getDefaultStepConfig(StepType.REMOVE_TAG)).toEqual({ tag: '' });
  });

  it('returns assign_agent defaults aligned to backend (agentId/teamId)', () => {
    expect(getDefaultStepConfig(StepType.ASSIGN_AGENT)).toEqual({
      agentId: '',
      teamId: '',
    });
  });

  it('returns ai_response defaults with prompt key', () => {
    expect(getDefaultStepConfig(StepType.AI_RESPONSE)).toEqual({ prompt: '' });
  });

  it('returns create_task defaults aligned to backend (dueInMs)', () => {
    expect(getDefaultStepConfig(StepType.CREATE_TASK)).toEqual({
      title: '',
      dueInMs: 86400000,
    });
  });

  it('produces a default config for every StepType (no missing types)', () => {
    for (const type of Object.values(StepType)) {
      const config = getDefaultStepConfig(type);
      expect(config).toBeTypeOf('object');
      expect(Object.keys(config).length).toBeGreaterThan(0);
    }
  });
});
