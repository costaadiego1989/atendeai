import { Injectable } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from '@langchain/core/messages';

export interface TextOutputChainInput {
  systemPrompt: string;
  userMessage: string;
  contextHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface TextOutputChain {
  invoke(input: TextOutputChainInput): Promise<string>;
}

export interface TextOutputChainOptions {
  model: BaseChatModel;
}

@Injectable()
export class TextOutputChainFactory {
  create(opts: TextOutputChainOptions): TextOutputChain {
    const { model } = opts;

    return {
      async invoke(input: TextOutputChainInput): Promise<string> {
        const messages = [
          new SystemMessage(input.systemPrompt),
          ...(input.contextHistory ?? []).map((msg) =>
            msg.role === 'user'
              ? new HumanMessage(msg.content)
              : new AIMessage(msg.content),
          ),
          new HumanMessage(input.userMessage),
        ];

        const result = await model.invoke(messages);
        return result.content as string;
      },
    };
  }
}
