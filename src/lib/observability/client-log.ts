/**
 * Minimal structured logger for the browser bundle: no dependencies and no network calls, so
 * nothing about a visitor can leave the page through it. Debug output is dropped in production.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

export function clientLog(level: Level, event: string, context?: Record<string, unknown>): void {
  if (level === 'debug' && !import.meta.env.DEV) return;
  const payload = { event, ...context };
  switch (level) {
    case 'error':
      console.error('[iss]', payload);
      return;
    case 'warn':
      console.warn('[iss]', payload);
      return;
    case 'info':
      console.info('[iss]', payload);
      return;
    case 'debug':
      console.debug('[iss]', payload);
      return;
  }
}
