import { context as otContext, trace } from '@opentelemetry/api';

/** Trace/span atuais para correlacionar logs estruturados com OTEL (ex.: webhooks HTTP). */
export function otelTraceLogFields(): { traceId?: string; spanId?: string } {
  const sc = trace.getSpan(otContext.active())?.spanContext();
  if (!sc?.traceId || !sc?.spanId) {
    return {};
  }
  return { traceId: sc.traceId, spanId: sc.spanId };
}
