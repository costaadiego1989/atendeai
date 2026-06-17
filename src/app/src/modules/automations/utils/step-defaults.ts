import { StepType } from '../types';

/**
 * Default config for a newly-added step of the given type.
 * Keys are aligned with the backend `CompositeStepExecutor` contract so the
 * configuration produced by the UI is consumed without translation.
 */
export function getDefaultStepConfig(type: StepType): Record<string, unknown> {
  switch (type) {
    case StepType.SEND_MESSAGE:
      return { channel: 'whatsapp', body: '' };
    case StepType.WAIT_DELAY:
      return { delayHuman: '1h', delayMs: 3600000 };
    case StepType.CONDITION_BRANCH:
      return { field: '', operator: 'equals', value: '' };
    case StepType.HTTP_REQUEST:
      return { method: 'POST', url: '', headers: {}, body: {} };
    case StepType.UPDATE_CONTACT:
      return { fields: {} };
    case StepType.ADD_TAG:
    case StepType.REMOVE_TAG:
      return { tag: '' };
    case StepType.ASSIGN_AGENT:
      return { agentId: '', teamId: '' };
    case StepType.AI_RESPONSE:
      return { prompt: '' };
    case StepType.CREATE_TASK:
      return { title: '', dueInMs: 86400000 };
    default:
      return {};
  }
}
