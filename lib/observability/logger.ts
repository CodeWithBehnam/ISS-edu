import { diag, DiagConsoleLogger, DiagLogLevel, trace } from '@opentelemetry/api';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  event: string;
  level?: LogLevel;
  context?: Record<string, unknown>;
}

export function log({ event, level = 'info', context }: LogPayload) {
  const span = trace.getActiveSpan();
  const enriched = {
    event,
    level,
    ...context,
    traceId: span?.spanContext().traceId,
  };

  switch (level) {
    case 'error':
      console.error(enriched);
      break;
    case 'warn':
      console.warn(enriched);
      break;
    case 'debug':
      console.debug(enriched);
      break;
    default:
      console.info(enriched);
  }
}

