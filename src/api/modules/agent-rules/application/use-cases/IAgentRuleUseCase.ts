export interface IAgentRuleUseCase<IN, OUT> {
  execute(input: IN): Promise<OUT>;
}
