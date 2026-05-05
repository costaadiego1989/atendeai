import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';

const base =
  process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://127.0.0.1:4318';

const traceUrl =
  process.env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'] ?? `${base}/v1/traces`;
const metricsUrl =
  process.env['OTEL_EXPORTER_OTLP_METRICS_ENDPOINT'] ?? `${base}/v1/metrics`;
  
const logsUrl =
  process.env['OTEL_EXPORTER_OTLP_LOGS_ENDPOINT'] ?? `${base}/v1/logs`;

const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'atendeai-api';

const resource = new Resource({
  'service.name': serviceName,
  'service.version': process.env['npm_package_version'] ?? '0.0.1',
  'deployment.environment': process.env['NODE_ENV'] ?? 'development',
});

const ratio = Math.min(
  1,
  Math.max(0, parseFloat(process.env['OTEL_TRACES_SAMPLER_ARG'] ?? '1')),
);

const logExporter = new OTLPLogExporter({ url: logsUrl });
const logProcessor = new BatchLogRecordProcessor(logExporter);
const loggerProvider = new LoggerProvider({
  resource,
  mergeResourceWithDefaults: false,
});
loggerProvider.addLogRecordProcessor(logProcessor);
logs.setGlobalLoggerProvider(loggerProvider);

const sdk = new NodeSDK({
  resource,
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(ratio),
  }),
  traceExporter: new OTLPTraceExporter({ url: traceUrl }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: metricsUrl }),
    exportIntervalMillis: 15_000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

try {
  sdk.start();
} catch (e) {
  console.error('OpenTelemetry init failed', e);
}

async function shutdown() {
  try {
    await sdk.shutdown();
    await loggerProvider.shutdown();
  } catch {
    /* ignore */
  }
}

process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
