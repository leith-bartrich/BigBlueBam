const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false;

export function trackEvent(name: string, props?: Record<string, unknown>) {
  // Log to console in dev, POST to /helpdesk/api/metrics in prod (future)
  if (isDev) {
    console.log('[metric]', name, props);
  }
  // TODO: send to backend metrics endpoint when implemented (HB-46)
}

export function trackTiming(name: string, durationMs: number, props?: Record<string, unknown>) {
  trackEvent(name, { ...props, duration_ms: durationMs });
}
