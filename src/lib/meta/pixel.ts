declare global {
  interface Window {
    fbq: (
      action: string,
      eventOrPixelId: string,
      data?: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => void;
  }
}

export function trackPixelEvent(
  eventName: string,
  eventId: string,
  data?: Record<string, unknown>
): void {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", eventName, data || {}, { eventID: eventId });
}

export function setPixelAdvancedMatching(userData: {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  ct?: string;
  st?: string;
}): void {
  if (typeof window === "undefined" || !window.fbq) return;

  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return;

  window.fbq("init", pixelId, userData);
}
