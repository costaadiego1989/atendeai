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

export interface QueuedToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface QueuedResponse {
  type: 'text' | 'tool_calls' | 'mixed';
  text?: string;
  toolCalls?: QueuedToolCall[];
}

interface SharedState {
  responses: string[];
  queuedResponses: QueuedResponse[];
  callIndex: number;
  callLog: BaseMessage[][];
}

export class FakeChatModel extends BaseChatModel {
  private state: SharedState = {
    responses: [],
    queuedResponses: [],
    callIndex: 0,
    callLog: [],
  };

  static lc_name(): string {
    return 'FakeChatModel';
  }

  get callCount(): number {
    return this.state.callLog.length;
  }

  get calls(): BaseMessage[][] {
    return this.state.callLog;
  }

  queueResponse(text: string): void {
    this.state.responses.push(text);
    this.state.queuedResponses.push({ type: 'text', text });
  }

  queueJson(obj: unknown): void {
    const text = JSON.stringify(obj);
    this.state.responses.push(text);
    this.state.queuedResponses.push({ type: 'text', text });
  }

  queueToolCall(name: string, args: Record<string, unknown>): void {
    this.state.responses.push('');
    this.state.queuedResponses.push({
      type: 'tool_calls',
      toolCalls: [{ name, args }],
    });
  }

  queueToolCalls(toolCalls: QueuedToolCall[]): void {
    this.state.responses.push('');
    this.state.queuedResponses.push({ type: 'tool_calls', toolCalls });
  }

  queueResponseWithTools(text: string, toolCalls: QueuedToolCall[]): void {
    this.state.responses.push(text);
    this.state.queuedResponses.push({ type: 'mixed', text, toolCalls });
  }

  reset(): void {
    this.state.responses = [];
    this.state.queuedResponses = [];
    this.state.callIndex = 0;
    this.state.callLog.length = 0;
  }

  _llmType(): string {
    return 'fake-chat-model';
  }

  private boundTools: unknown[] | null = null;
  private structuredOutputMode = false;

  bindTools(tools: unknown[]): this {
    const clone = new FakeChatModel({}) as this;
    // Share all mutable state so parent can inspect calls/queue
    (clone as FakeChatModel).state = this.state;
    (clone as FakeChatModel).boundTools = tools;
    return clone;
  }

  withStructuredOutput(schema: any, ..._rest: any[]): any {
    // Mark for structured output mode
    const bound = this.bindTools([schema]);
    (bound as FakeChatModel).structuredOutputMode = true;

    return {
      async invoke(messages: any) {
        const result = await bound.invoke(messages);
        // Extract tool_call args (the structured output)
        if (result.tool_calls && result.tool_calls.length > 0) {
          return result.tool_calls[0].args;
        }
        // Fallback: try to parse content as JSON
        try {
          return JSON.parse(result.content as string);
        } catch {
          return result.content;
        }
      },
    };
  }

  async _generate(
    messages: BaseMessage[],
    _options?: BaseChatModelCallOptions,
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    this.state.callLog.push(messages);

    if (this.state.callIndex >= this.state.queuedResponses.length) {
      throw new Error(
        `FakeChatModel: no more queued responses (called ${this.state.callIndex + 1} times, only ${this.state.queuedResponses.length} responses queued)`,
      );
    }

    const queued = this.state.queuedResponses[this.state.callIndex++];

    // Explicit tool_calls queued (queueToolCall / queueToolCalls)
    if (queued.type === 'tool_calls') {
      const message = new AIMessageChunk({
        content: '',
        tool_calls: queued.toolCalls!.map((tc, i) => ({
          id: `call_fake_${this.state.callLog.length}_${i}`,
          name: tc.name,
          args: tc.args,
        })),
      });
      return { generations: [{ message, text: '' }] };
    }

    // Mixed: text + tool_calls (queueResponseWithTools)
    if (queued.type === 'mixed') {
      const message = new AIMessageChunk({
        content: queued.text ?? '',
        tool_calls: queued.toolCalls!.map((tc, i) => ({
          id: `call_fake_${this.state.callLog.length}_${i}`,
          name: tc.name,
          args: tc.args,
        })),
      });
      return { generations: [{ message, text: queued.text ?? '' }] };
    }

    // Text response — only intercept for withStructuredOutput mode
    const response = queued.text ?? '';

    if (
      this.structuredOutputMode &&
      this.boundTools &&
      this.boundTools.length > 0
    ) {
      const tool = this.boundTools[0] as Record<string, unknown>;
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
            id: `call_fake_${this.state.callLog.length}`,
            name: toolName,
            args: parsedArgs,
          },
        ],
      });

      return { generations: [{ message, text: '' }] };
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
