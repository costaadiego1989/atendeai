/**
 * Supported automation step types.
 */
export enum StepType {
  /** Send a WhatsApp/channel message */
  SEND_MESSAGE = 'send_message',
  /** Wait for a specified delay */
  WAIT_DELAY = 'wait_delay',
  /** Conditional branch (if/else) */
  CONDITION_BRANCH = 'condition_branch',
  /** Make an HTTP request (webhook) */
  HTTP_REQUEST = 'http_request',
  /** Update contact fields */
  UPDATE_CONTACT = 'update_contact',
  /** Add tag to contact */
  ADD_TAG = 'add_tag',
  /** Remove tag from contact */
  REMOVE_TAG = 'remove_tag',
  /** Assign to agent/team */
  ASSIGN_AGENT = 'assign_agent',
  /** Send AI-generated response */
  AI_RESPONSE = 'ai_response',
  /** Create a task/reminder */
  CREATE_TASK = 'create_task',
}

export interface StepConfig {
  type: StepType;
  config: Record<string, unknown>;
}

/** Send message step config */
export interface SendMessageConfig {
  channel: 'whatsapp' | 'instagram' | 'web_chat';
  template?: string;
  body: string;
  mediaUrl?: string;
}

/** Wait delay step config */
export interface WaitDelayConfig {
  delayMs: number;
  /** Human-readable: "5m", "1h", "2d" */
  delayHuman: string;
}

/** Condition branch step config */
export interface ConditionBranchConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'exists';
  value: unknown;
  trueStepId?: string;
  falseStepId?: string;
}

/** HTTP request step config */
export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}
