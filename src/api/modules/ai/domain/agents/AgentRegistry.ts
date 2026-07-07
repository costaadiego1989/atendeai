import type { AgentDefinition } from './AgentDefinition';
import type { BusinessType } from '../value-objects/ConversationPhase';
import {
  SalesAgentDefinition,
  RecoveryAgentDefinition,
  SchedulingAgentDefinition,
  CommerceAgentDefinition,
  SupportAgentDefinition,
} from './definitions';

const ALL_AGENTS: AgentDefinition[] = [
  SalesAgentDefinition,
  RecoveryAgentDefinition,
  SchedulingAgentDefinition,
  CommerceAgentDefinition,
  SupportAgentDefinition,
];

export class AgentRegistry {
  static getByBusinessType(type: BusinessType): AgentDefinition {
    const found = ALL_AGENTS.find((a) => a.businessTypes.includes(type));
    return found ?? SalesAgentDefinition;
  }

  static getByIntent(intent: string): AgentDefinition | null {
    const found = ALL_AGENTS.find((a) => a.intents.includes(intent));
    return found ?? null;
  }

  static getById(id: string): AgentDefinition {
    const found = ALL_AGENTS.find((a) => a.id === id);
    if (!found) {
      throw new Error(`Agent not found: ${id}`);
    }
    return found;
  }

  static getDefault(): AgentDefinition {
    return SalesAgentDefinition;
  }

  static getAll(): AgentDefinition[] {
    return [...ALL_AGENTS];
  }
}
