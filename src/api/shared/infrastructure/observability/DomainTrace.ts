import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('atendeai-domain');

export function traceSync<T>(
  spanName: string,
  attributes: Record<string, string>,
  fn: () => T,
): T {
  return tracer.startActiveSpan(spanName, (span) => {
    try {
      span.setAttributes(attributes);
      return fn();
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw e;
    } finally {
      span.end();
    }
  });
}

export async function traceAsync<T>(
  spanName: string,
  attributes: Record<string, string>,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      span.setAttributes(attributes);
      return await fn();
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw e;
    } finally {
      span.end();
    }
  });
}
