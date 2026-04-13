"use client";

import { useEffect, useRef } from "react";
import { extractUTMFromURL, persistUTMParams, getStoredUTMParams, type UTMParams } from "@/lib/tracking/utm";
import { getFBCookies, getOrBuildFBC } from "@/lib/tracking/cookies";

export function useUTMParams(): UTMParams & { fbc: string | null; fbp: string | null } {
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;

    const params = extractUTMFromURL();
    persistUTMParams(params);
  }, []);

  const stored = typeof window !== "undefined" ? getStoredUTMParams() : {
    utm_source: null, utm_medium: null, utm_campaign: null,
    utm_content: null, utm_term: null, fbclid: null,
    ad_name: null, adset_name: null, campaign_name: null,
    creative_type: null, ad_id: null, adset_id: null, campaign_id: null,
  };

  const { fbc: cookieFbc, fbp } = typeof window !== "undefined" ? getFBCookies() : { fbc: null, fbp: null };
  const fbc = cookieFbc || getOrBuildFBC(stored.fbclid);

  return { ...stored, fbc, fbp };
}
