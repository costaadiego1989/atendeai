import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from '@langchain/core/messages';
import { StructuredOutputParseError } from '../errors';

export interface StructuredOutputChainOptions<T extends z.ZodType> {
  schema: T;
  model: BaseChatModel;
  systemPrompt: string;
  maxRetries?: number;
}

export interface StructuredOutputChainInput {
  userMessage: string;
  contextHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface StructuredOutputChain<T extends z.ZodType> {
  invoke(input: StructuredOutputChainInput): Promise<z.infer<T>>;
}

@Injectable()
export class StructuredOutputChainFactory {
  create<T extends z.ZodType>(
    opts: StructuredOutputChainOptions<T>,
  ): StructuredOutputChain<T> {
    const { schema, model, systemPrompt, maxRetries = 2 } = opts;
    const structuredModel = model.withStructuredOutput(schema);

    return {
      async invoke(input: StructuredOutputChainInput): Promise<z.infer<T>> {
        const messages = [
          new SystemMessage(systemPrompt),
          ...(input.contextHistory ?? []).map((msg) =>
            msg.role === 'user'
              ? new HumanMessage(msg.content)
              : new AIMessage(msg.content),
          ),
          new HumanMessage(input.userMessage),
        ];

        let lastError: unknown = null;
        let lastAttempt: unknown = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await structuredModel.invoke(messages);
            return result as z.infer<T>;
          } catch (error) {
            lastError = error;
            lastAttempt = error instanceof z.ZodError ? undefined : null;
          }
        }

        const zodErrors = lastError instanceof z.ZodError ? lastError : null;

        throw new StructuredOutputParseError(
          `Structured output parsing failed after ${maxRetries + 1} attempts`,
          lastAttempt,
          zodErrors,
        );
      },
    };
  }
}
