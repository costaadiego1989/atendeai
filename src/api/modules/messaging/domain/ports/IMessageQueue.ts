export interface MessageQueueJob {
  messageId: string;
}

export interface IMessageQueue {
  addJob(job: MessageQueueJob): Promise<void>;
}

export const MESSAGE_QUEUE = Symbol('IMessageQueue');
