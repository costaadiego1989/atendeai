export interface ExecuteProspectSearchInput {
  searchId: string;
}

export interface ExecuteProspectSearchOutput {
  searchId: string;
  status: 'COMPLETED' | 'FAILED';
  discoveredCount: number;
}

export interface IExecuteProspectSearchUseCase {
  execute(
    input: ExecuteProspectSearchInput,
  ): Promise<ExecuteProspectSearchOutput>;
}

export const IExecuteProspectSearchUseCase = Symbol(
  'IExecuteProspectSearchUseCase',
);
