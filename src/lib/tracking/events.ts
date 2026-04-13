export type MetaEventName = "PageView" | "ViewContent" | "Lead" | "CompleteRegistration";

export function generateEventId(): string {
  return crypto.randomUUID();
}

export async function sendTrackingEvent(data: {
  event_name: MetaEventName;
  event_id: string;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  url?: string;
  user_data?: Record<string, string | null>;
}): Promise<void> {
  try {
    await fetch("/api/tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: data.event_name,
        event_id: data.event_id,
        fbclid: data.fbclid || null,
        fbc: data.fbc || null,
        fbp: data.fbp || null,
        url: data.url || (typeof window !== "undefined" ? window.location.href : ""),
        user_data: data.user_data || {},
      }),
    });
  } catch {
    // Fire and forget - don't block UX
  }
}
