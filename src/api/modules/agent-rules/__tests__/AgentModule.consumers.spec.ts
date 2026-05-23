import { AgentModule } from '../domain/enums/AgentModule';
import { parseAgentModule } from '../application/support/agentRuleDraft';

/**
 * ADR D9 (resolves G11): AI consumers must only request module scopes that
 * exist in the AgentModule enum. These are the literal scopes the live
 * consumers pass to TenantAgentRuleService.getRule:
 *  - messaging/SuggestAgentReplyService -> 'messaging'
 *  - ai/ProcessAIResponseService        -> input.moduleId || 'messaging'
 */
describe('AgentModule consumer contract', () => {
  const consumerRequestedModules: string[] = [
    'messaging', // SuggestAgentReplyService (hard-coded) + ProcessAIResponseService default
  ];

  it('AGENT-U-090: every module requested by AI consumers is a supported AgentModule value', () => {
    const supported = Object.values(AgentModule) as string[];

    for (const requested of consumerRequestedModules) {
      expect(supported).toContain(requested);
    }
  });

  it('AGENT-U-091: consumer-requested modules pass parseAgentModule without throwing', () => {
    for (const requested of consumerRequestedModules) {
      expect(() => parseAgentModule(requested)).not.toThrow();
      expect(parseAgentModule(requested)).toBe(requested);
    }
  });

  it('AGENT-U-092: parseAgentModule rejects a scope not declared in the enum', () => {
    expect(() => parseAgentModule('not_a_real_module')).toThrow();
  });
});
