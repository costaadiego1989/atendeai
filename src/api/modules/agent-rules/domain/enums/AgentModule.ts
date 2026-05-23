/**
 * AgentModule ↔ platform-module / consumer mapping (ADR D9, resolves G11).
 *
 * Each value is a functional scope for a per-(tenant, branch) AI prompt rule.
 * The names below are agent-rule scopes and do not all map 1:1 to platform
 * module folder names; this table is the single source of truth for that drift.
 *
 * | AgentModule value | Platform module(s)        | Consumer(s) requesting it          |
 * |-------------------|---------------------------|------------------------------------|
 * | messaging         | messaging                 | messaging/SuggestAgentReplyService |
 * |                   |                           | ai/ProcessAIResponseService        |
 * | prospecting       | prospecting               | (admin-configured; no AI consumer) |
 * | checkout          | commerce / payment        | (admin-configured; no AI consumer) |
 * | scheduling        | scheduling                | (admin-configured; no AI consumer) |
 * | sales             | sales                     | (admin-configured; no AI consumer) |
 * | recovery          | recovery                  | (admin-configured; no AI consumer) |
 * | channels          | social / messaging        | (admin-configured; no AI consumer) |
 * | alerts            | alerts                    | (admin-configured; no AI consumer) |
 * | team              | platform-admin / tenant   | (admin-configured; no AI consumer) |
 * | billing           | billing                   | (admin-configured; no AI consumer) |
 * | widget            | messaging (widget surface)| (admin-configured; no AI consumer) |
 *
 * AI consumers MUST only request values present in this enum. The test
 * `AgentModule.consumers.spec.ts` asserts that invariant for the live consumers.
 */
export enum AgentModule {
  MESSAGING = 'messaging',
  PROSPECTING = 'prospecting',
  CHECKOUT = 'checkout',
  SCHEDULING = 'scheduling',
  SALES = 'sales',
  RECOVERY = 'recovery',
  CHANNELS = 'channels',
  ALERTS = 'alerts',
  TEAM = 'team',
  BILLING = 'billing',
  WIDGET = 'widget',
}
