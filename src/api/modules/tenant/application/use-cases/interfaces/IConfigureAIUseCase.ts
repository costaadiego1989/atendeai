import { IUseCase } from '@shared/application/IUseCase';

export interface ConfigureAIInput {
  tenantId: string;
  requestingUserId?: string;
  requestingUserEmail?: string;
  systemPrompt: string;
  tone: 'FRIENDLY' | 'PROFESSIONAL' | 'CASUAL';
  language?: string;
  maxTokensPerResponse?: number;
  confidenceThreshold?: number;
  escalationMessage?: string;
  businessRules?: string[];
}

export interface ConfigureAIOutput {
  id: string;
  systemPrompt: string;
  tone: string;
  updatedAt: Date;
}

export interface IConfigureAIUseCase extends IUseCase<
  ConfigureAIInput,
  ConfigureAIOutput
> {}
export const IConfigureAIUseCase = Symbol('IConfigureAIUseCase');
