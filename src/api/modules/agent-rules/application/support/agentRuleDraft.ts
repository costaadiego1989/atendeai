import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { AgentModule } from '../../domain/enums/AgentModule';

export const MAX_AGENT_RULE_PROMPT_LENGTH = 1500;

export function parseAgentModule(moduleId: string): AgentModule {
  const allowedModules = Object.values(AgentModule);

  if (!allowedModules.includes(moduleId as AgentModule)) {
    throw new ValidationErrorException(
      `Invalid module. Allowed: ${allowedModules.join(', ')}`,
    );
  }

  return moduleId as AgentModule;
}

export function normalizeAgentPrompt(customPrompt: string): string {
  const trimmed = customPrompt.trim();

  if (trimmed.length > MAX_AGENT_RULE_PROMPT_LENGTH) {
    throw new ValidationErrorException(
      `Custom prompt is too long (max ${MAX_AGENT_RULE_PROMPT_LENGTH} characters)`,
    );
  }

  return trimmed;
}
