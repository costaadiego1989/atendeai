export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface IChatHistoryRepository {
  getHistory(conversationId: string): Promise<ChatMessage[]>;
  saveMessage(conversationId: string, message: ChatMessage): Promise<void>;
  clearHistory(conversationId: string): Promise<void>;
}

export const CHAT_HISTORY_REPOSITORY = Symbol('CHAT_HISTORY_REPOSITORY');
