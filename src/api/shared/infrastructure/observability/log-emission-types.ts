export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredEmitInput {
  level: StructuredLogLevel;
  event: string;
  message: string;
  attributes?: Record<string, string | number | boolean>;
  traceId?: string;
  spanId?: string;
  tenantId?: string;
}
