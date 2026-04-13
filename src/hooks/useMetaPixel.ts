"use client";

import { useCallback } from "react";
import { trackPixelEvent } from "@/lib/meta/pixel";
import { generateEventId, sendTrackingEvent, type MetaEventName } from "@/lib/tracking/events";

export function useMetaPixel() {
  const fireEvent = useCallback(
    (
      eventName: MetaEventName,
      options?: {
        eventId?: string;
        fbclid?: string | null;
        fbc?: string | null;
        fbp?: string | null;
        userData?: Record<string, string | null>;
        customData?: Record<string, unknown>;
      }
    ) => {
      const eventId = options?.eventId || generateEventId();

      // Client-side Pixel
      trackPixelEvent(eventName, eventId, options?.customData);

      // Server-side CAPI relay
      sendTrackingEvent({
        event_name: eventName,
        event_id: eventId,
        fbclid: options?.fbclid,
        fbc: options?.fbc,
        fbp: options?.fbp,
        user_data: options?.userData,
      });

      return eventId;
    },
    []
  );

  return { fireEvent, generateEventId };
}
