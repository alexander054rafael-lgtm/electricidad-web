/**
 * Lightweight Production Logger & Request Tracing for InduTech Academy.
 *
 * Features:
 * - Zero external dependencies.
 * - Suppresses DEBUG level in production (import.meta.env.PROD).
 * - Standardized format: [TIMESTAMP] [LEVEL] [REQ_ID] Message
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD;

  private formatMessage(level: LogLevel, message: string, requestId?: string) {
    const timestamp = new Date().toISOString();
    const reqStr = requestId ? ` [${requestId}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${reqStr} ${message}`;
  }

  debug(message: string, requestId?: string, ...args: unknown[]) {
    if (this.isProd) return;
    console.debug(this.formatMessage('debug', message, requestId), ...args);
  }

  info(message: string, requestId?: string, ...args: unknown[]) {
    console.info(this.formatMessage('info', message, requestId), ...args);
  }

  warn(message: string, requestId?: string, ...args: unknown[]) {
    console.warn(this.formatMessage('warn', message, requestId), ...args);
  }

  error(message: string, requestId?: string, ...args: unknown[]) {
    console.error(this.formatMessage('error', message, requestId), ...args);
  }
}

export const logger = new Logger();

/**
 * Generate or extract a unique Request ID for request tracing.
 */
export function getOrCreateRequestId(request?: Request): string {
  if (request) {
    const existing = request.headers.get('x-request-id') || request.headers.get('x-correlation-id');
    if (existing) return existing;
  }
  return `req_${crypto.randomUUID().slice(0, 8)}`;
}
