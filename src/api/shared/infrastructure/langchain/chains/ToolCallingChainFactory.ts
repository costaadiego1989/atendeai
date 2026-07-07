import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from '@langchain/core/messages';

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType;
}

export interface ToolCallResult {
  name: string;
  args: Record<string, unknown>;
  id: string;
}

export interface ToolCallingChainOutput {
  textResponse: string;
  toolCalls: ToolCallResult[];
}

export interface ToolCallingChainInput {
  systemPrompt: string;
  userMessage: string;
  contextHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ToolCallingChain {
  invoke(input: ToolCallingChainInput): Promise<ToolCallingChainOutput>;
}

export interface ToolCallingChainOptions {
  model: BaseChatModel;
  tools: ToolDefinition[];
}

@Injectable()
export class ToolCallingChainFactory {
  create(opts: ToolCallingChainOptions): ToolCallingChain {
    const { model, tools } = opts;

    const langchainTools = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.schema),
      },
    }));

    const boundModel = (model as any).bindTools(langchainTools);

    return {
      async invoke(
        input: ToolCallingChainInput,
      ): Promise<ToolCallingChainOutput> {
        const messages = [
          new SystemMessage(input.systemPrompt),
          ...(input.contextHistory ?? []).map((msg) =>
            msg.role === 'user'
              ? new HumanMessage(msg.content)
              : new AIMessage(msg.content),
          ),
          new HumanMessage(input.userMessage),
        ];

        const result = await boundModel.invoke(messages);

        const textResponse =
          typeof result.content === 'string' ? result.content : '';

        const toolCalls: ToolCallResult[] = (result.tool_calls ?? []).map(
          (tc: any) => ({
            name: tc.name,
            args: tc.args as Record<string, unknown>,
            id: tc.id ?? `call_${Date.now()}`,
          }),
        );

        return { textResponse, toolCalls };
      },
    };
  }
}

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // Use zod's built-in shape inspection for objects
  const def = (schema as any)._def ?? (schema as any)._zod;
  if (!def) return { type: 'object' };

  // Zod 3 uses _def.shape(), Zod 4 uses .shape directly
  const shape =
    typeof (schema as any).shape === 'object'
      ? (schema as any).shape
      : typeof def.shape === 'function'
        ? def.shape()
        : null;

  if (!shape) return { type: 'object' };

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const field = value as any;
    properties[key] = zodFieldToJson(field);
    if (!isOptionalField(field)) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function zodFieldToJson(field: any): Record<string, unknown> {
  const typeName = field?._def?.typeName ?? field?._zod?.def?.type ?? '';
  const description = field?.description ?? field?._def?.description;

  switch (typeName) {
    case 'ZodString':
      return { type: 'string', ...(description ? { description } : {}) };
    case 'ZodNumber':
      return { type: 'number', ...(description ? { description } : {}) };
    case 'ZodBoolean':
      return { type: 'boolean', ...(description ? { description } : {}) };
    case 'ZodEnum': {
      const values = field?._def?.values ?? field?.options;
      return {
        type: 'string',
        ...(values ? { enum: values } : {}),
        ...(description ? { description } : {}),
      };
    }
    case 'ZodOptional':
      return zodFieldToJson(field?._def?.innerType ?? field?.unwrap?.());
    case 'ZodDefault':
      return zodFieldToJson(field?._def?.innerType ?? field?.removeDefault?.());
    default:
      return { type: 'string' };
  }
}

function isOptionalField(field: any): boolean {
  const typeName = field?._def?.typeName ?? '';
  return typeName === 'ZodOptional' || typeName === 'ZodDefault';
}
