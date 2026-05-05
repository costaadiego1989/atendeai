import { Injectable, Logger } from '@nestjs/common';
import { SeverityNumber, logs } from '@opentelemetry/api-logs';
import type { StructuredEmitInput } from './log-emission-types';

const LEVEL_TO_OTEL: Record<
  StructuredEmitInput['level'],
  SeverityNumber
> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

@Injectable()
export class StructuredLogEmitter {
  private readonly nest = new Logger(StructuredLogEmitter.name);
  private readonly otelLogger = logs.getLogger('atendeai-structured');

  static buildJsonLine(input: StructuredEmitInput): string {
    const attrs = input.attributes ?? {};
    const envelope = {
      '@timestamp': new Date().toISOString(),
      level: input.level,
      event: input.event,
      message: input.message,
      trace_id: input.traceId ?? '',
      span_id: input.spanId ?? '',
      tenant_id: input.tenantId ?? '',
      attributes: attrs,
    };
    return JSON.stringify(envelope);
  }

  emit(input: StructuredEmitInput): void {
    const line = StructuredLogEmitter.buildJsonLine(input);
    if (process.env['STRUCTURED_LOG_STDOUT'] !== 'false') {
      process.stdout.write(`${line}\n`);
    }

    const attrs: Record<string, string> = {
      event: input.event,
      ...(input.traceId ? { trace_id: input.traceId } : {}),
      ...(input.spanId ? { span_id: input.spanId } : {}),
      ...(input.tenantId ? { tenant_id: input.tenantId } : {}),
    };

    this.otelLogger.emit({
      severityNumber: LEVEL_TO_OTEL[input.level],
      severityText: input.level.toUpperCase(),
      body: line,
      attributes: attrs,
    });
  }

  nestFallback(message: string, err?: unknown): void {
    this.nest.error(message, err instanceof Error ? err.stack : String(err));
  }
}
