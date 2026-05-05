export interface SuggestAgentReplyInput {
  tenantId: string;
  conversationId: string;
}

export interface SuggestAgentReplyOutput {
  text: string;
}

export const SUGGEST_AGENT_REPLY_USE_CASE = Symbol('ISuggestAgentReplyUseCase');

export interface ISuggestAgentReplyUseCase {
  execute(input: SuggestAgentReplyInput): Promise<SuggestAgentReplyOutput>;
}
