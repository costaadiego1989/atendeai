export interface MessageQueueJob {
  messageId: string;
  /** tenantId enables the outbound processor to scope the conversation lookup,
   *  preventing cross-tenant reads in findByMessageId.  Required for all new jobs. */
  tenantId: string;
}

export interface IMessageQueue {
  addJob(job: MessageQueueJob): Promise<void>;
}

export const MESSAGE_QUEUE = Symbol('IMessageQueue');
