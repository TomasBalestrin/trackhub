export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  email: string;
  phone: string;
  monthly_income: string | null;
  city: string | null;
  state: string | null;
  how_found: string | null;
  source: string | null;
  position: string | null;
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
  landing_page_url: string | null;
  referrer: string | null;
  user_agent: string | null;
  ip_address: string | null;
  fbc: string | null;
  fbp: string | null;
  page_view_at: string | null;
  view_content_at: string | null;
  lead_at: string | null;
  complete_registration_at: string | null;
  qualification_score: number;
  status: LeadStatus;
  whatsapp_group_sent: boolean;
  event_id_page_view: string | null;
  event_id_view_content: string | null;
  event_id_lead: string | null;
  event_id_complete_registration: string | null;
}

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

export interface TrackingEvent {
  id: string;
  created_at: string;
  lead_id: string | null;
  event_name: string;
  event_id: string;
  event_source: "pixel" | "server";
  event_time: string;
  fbclid: string | null;
  fbc: string | null;
  fbp: string | null;
  ip_address: string | null;
  user_agent: string | null;
  payload: Record<string, unknown>;
  capi_sent: boolean;
  capi_response: Record<string, unknown> | null;
}

export interface MetaCampaignCache {
  id: string;
  updated_at: string;
  campaign_id: string;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  creative_type: string | null;
  creative_thumbnail_url: string | null;
  status: string | null;
  daily_budget: number | null;
  objective: string | null;
  raw_data: Record<string, unknown> | null;
}

export const INCOME_OPTIONS = [
  { value: "0_15000", label: "Até R$ 15.000" },
  { value: "15000_30000", label: "R$ 15.000 - R$ 30.000" },
  { value: "30000_100000", label: "R$ 30.000 - R$ 100.000" },
  { value: "100000_250000", label: "R$ 100.000 - R$ 250.000" },
  { value: "250000_500000", label: "R$ 250.000 - R$ 500.000" },
  { value: "500000_1000000", label: "R$ 500.000 - R$ 1.000.000" },
  { value: "1000000_999999999", label: "Acima de R$ 1.000.000" },
] as const;

export const HOW_FOUND_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "youtube", label: "YouTube" },
  { value: "indicacao", label: "Indicação" },
  { value: "outro", label: "Outro" },
] as const;

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
