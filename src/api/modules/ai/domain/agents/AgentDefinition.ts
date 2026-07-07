import { z } from 'zod';
import type { ToolDefinition } from '@shared/infrastructure/langchain/chains/ToolCallingChainFactory';
import type {
  BusinessType,
  PhaseDefinition,
} from '../value-objects/ConversationPhase';

export interface AgentDefinition {
  id: string;
  name: string;
  businessTypes: BusinessType[];
  intents: string[];
  systemPromptTemplate: string;
  tools: ToolDefinition[];
  responseSchema: z.ZodType;
  phases: PhaseDefinition;
  defaultPhase: string;
}

export type AgentId =
  | 'sales'
  | 'recovery'
  | 'scheduling'
  | 'commerce'
  | 'support';
