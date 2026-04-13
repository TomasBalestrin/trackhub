export interface UTMParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  creative_type: string | null;
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
}

const UTM_KEYS: (keyof UTMParams)[] = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "fbclid", "ad_name", "adset_name", "campaign_name", "creative_type",
  "ad_id", "adset_id", "campaign_id",
];

const STORAGE_KEY = "bethel_track_utm";

export function extractUTMFromURL(): UTMParams {
  if (typeof window === "undefined") return getEmptyUTM();

  const params = new URLSearchParams(window.location.search);
  const utm: UTMParams = getEmptyUTM();

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) utm[key] = value;
  }

  return utm;
}

export function persistUTMParams(params: UTMParams): void {
  if (typeof window === "undefined") return;

  const hasValues = Object.values(params).some((v) => v !== null);
  if (!hasValues) return;

  const json = JSON.stringify(params);
  sessionStorage.setItem(STORAGE_KEY, json);
  localStorage.setItem(STORAGE_KEY, json);
}

export function getStoredUTMParams(): UTMParams {
  if (typeof window === "undefined") return getEmptyUTM();

  const session = sessionStorage.getItem(STORAGE_KEY);
  if (session) return JSON.parse(session);

  const local = localStorage.getItem(STORAGE_KEY);
  if (local) return JSON.parse(local);

  return getEmptyUTM();
}

function getEmptyUTM(): UTMParams {
  return {
    utm_source: null, utm_medium: null, utm_campaign: null,
    utm_content: null, utm_term: null, fbclid: null,
    ad_name: null, adset_name: null, campaign_name: null,
    creative_type: null, ad_id: null, adset_id: null, campaign_id: null,
  };
}
