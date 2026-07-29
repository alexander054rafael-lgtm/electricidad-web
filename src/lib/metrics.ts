/**
 * Lightweight Telemetry & Metrics Scaffolding for Document Reading.
 * Ready for future production analytics integration.
 */

export type ReadingMetricEventName =
  | 'pdf_open'
  | 'pdf_first_page_rendered'
  | 'pdf_load_error'
  | 'pdf_cancelled'
  | 'pdf_page_change';

export interface ReadingMetricEvent {
  eventName: ReadingMetricEventName;
  resourceId: string;
  durationMs?: number;
  currentPage?: number;
  totalPages?: number;
  errorMessage?: string;
  timestamp: number;
}

/**
 * Dispatch reading telemetry metrics.
 */
export function trackReadingMetric(event: ReadingMetricEvent): void {
  if (typeof window === 'undefined') return;
  // Pluggable metrics dispatcher (e.g. analytics collector endpoint)
}
