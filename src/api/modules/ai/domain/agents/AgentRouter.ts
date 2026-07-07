import type { AgentDefinition } from './AgentDefinition';
import type { BusinessType } from '../value-objects/ConversationPhase';
import { AgentRegistry } from './AgentRegistry';

export interface AgentRoutingInput {
  businessType: BusinessType;
  currentPhase: string | null;
  lastIntent: string | null;
  tenantOverride?: string;
}

export interface AgentRoutingResult {
  agent: AgentDefinition;
  reason: string;
}

const SUPPORT_PHASES = new Set(['SUPPORT', 'COMPLAINT']);

export class AgentRouter {
  route(input: AgentRoutingInput): AgentRoutingResult {
    // Priority 1: Tenant override (admin forced a specific agent)
    if (input.tenantOverride) {
      try {
        const agent = AgentRegistry.getById(input.tenantOverride);
        return { agent, reason: `tenant_override:${input.tenantOverride}` };
      } catch {
        // Invalid override, fall through
      }
    }

    // Priority 2: Intent override (COMPLAINT → SupportAgent)
    if (input.lastIntent) {
      const intentAgent = AgentRegistry.getByIntent(input.lastIntent);
      if (intentAgent) {
        return {
          agent: intentAgent,
          reason: `intent_override:${input.lastIntent}`,
        };
      }
    }

    // Priority 3: Phase override (SUPPORT/COMPLAINT phase → SupportAgent)
    if (input.currentPhase && SUPPORT_PHASES.has(input.currentPhase)) {
      return {
        agent: AgentRegistry.getById('support'),
        reason: `phase_override:${input.currentPhase}`,
      };
    }

    // Priority 4: Business type mapping
    const agent = AgentRegistry.getByBusinessType(input.businessType);
    if (agent.id !== 'sales') {
      return {
        agent,
        reason: `business_type:${input.businessType}`,
      };
    }

    // Default: SalesAgent
    return { agent, reason: 'default:sales' };
  }
}
