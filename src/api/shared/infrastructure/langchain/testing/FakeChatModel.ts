import {
  BaseChatModel,
  type BaseChatModelCallOptions,
} from '@langchain/core/language_models/chat_models';
import {
  AIMessageChunk,
  type BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';

export class FakeChatModel extends BaseChatModel {
  private responses: string[] = [];
  private callIndex = 0;
  private readonly callLog: BaseMessage[][] = [];

  static lc_name(): string {
    return 'FakeChatModel';
  }

  get callCount(): number {
    return this.callLog.length;
  }

  get calls(): BaseMessage[][] {
    return this.callLog;
  }

  queueResponse(text: string): void {
    this.responses.push(text);
  }

  queueJson(obj: unknown): void {
    this.responses.push(JSON.stringify(obj));
  }

  reset(): void {
    this.responses = [];
    this.callIndex = 0;
    this.callLog.length = 0;
  }

  _llmType(): string {
    return 'fake-chat-model';
  }

  private boundTools: unknown[] | null = null;

  bindTools(tools: unknown[]): this {
    const clone = new FakeChatModel({}) as this;
    clone.responses = this.responses;
    clone.callIndex = this.callIndex;
    (clone as FakeChatModel).boundTools = tools;
    return clone;
  }

  async _generate(
    messages: BaseMessage[],
    _options?: BaseChatModelCallOptions,
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    this.callLog.push(messages);

    if (this.callIndex >= this.responses.length) {
      throw new Error(
        `FakeChatModel: no more queued responses (called ${this.callIndex + 1} times, only ${this.responses.length} responses queued)`,
      );
    }

    const response = this.responses[this.callIndex++];

    // When bound to tools (withStructuredOutput), return as tool_call
    if (this.boundTools && this.boundTools.length > 0) {
      const tool = this.boundTools[0] as Record<string, unknown>;
      // LangChain tools have shape: { name: string, ... } or { function: { name } }
      const toolName =
        (typeof tool?.name === 'string' && tool.name) ||
        (typeof (tool?.function as Record<string, unknown>)?.name ===
          'string' &&
          ((tool.function as Record<string, unknown>).name as string)) ||
        'structured_output';
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = JSON.parse(response);
      } catch {
        parsedArgs = { raw: response };
      }

      const message = new AIMessageChunk({
        content: '',
        tool_calls: [
          {
            id: `call_fake_${this.callLog.length}`,
            name: toolName,
            args: parsedArgs,
          },
        ],
      });

      return {
        generations: [{ message, text: '' }],
      };
    }

    return {
      generations: [
        {
          message: new AIMessageChunk(response),
          text: response,
        },
      ],
    };
  }
}
