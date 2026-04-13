import {
  AdListResponse,
  AdsetDetailListResponse,
  AdsetListResponse,
  CampaignListResponse,
  parseMetaList,
  type AdsetDetailItem,
} from "./schemas";

interface MetaAdData {
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  creative_type: string | null;
  status: string;
  daily_budget: number | null;
  objective: string | null;
}

/**
 * Resumo estruturado de um objeto `targeting` do Meta. Campos completos do
 * Graph são vastos — aqui manejamos os que o time de marketing pergunta com
 * mais frequência. Se precisar de mais campos, estender este tipo.
 */
export interface TargetingSummary {
  age_min: number | null;
  age_max: number | null;
  genders: ("male" | "female" | "all")[];
  geo_countries: string[];
  geo_regions: string[];
  geo_cities: string[];
  interests_count: number;
  behaviors_count: number;
  custom_audiences_count: number;
  raw_locales: number[];
}

export interface MetaAdsetRow {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  status: string | null;
  daily_budget: number | null;      // em reais
  lifetime_budget: number | null;   // em reais
  bid_strategy: string | null;
  optimization_goal: string | null;
  billing_event: string | null;
  targeting: TargetingSummary;
  start_time: string | null;
  end_time: string | null;
  raw: AdsetDetailItem;
}

const META_API = "https://graph.facebook.com/v21.0";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  return res.json();
}

function centsToReais(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n / 100 : null;
}

export function summarizeTargeting(raw: unknown): TargetingSummary {
  const t = (raw ?? {}) as Record<string, unknown>;
  const g = (t.genders ?? []) as number[];
  const genders: TargetingSummary["genders"] =
    g.length === 0
      ? ["all"]
      : g.map((x) => (x === 1 ? "male" : x === 2 ? "female" : "all"));

  const gl = (t.geo_locations ?? {}) as Record<string, unknown>;
  const countries = Array.isArray(gl.countries) ? (gl.countries as string[]) : [];
  const regions = Array.isArray(gl.regions)
    ? (gl.regions as Array<{ name?: string }>).map((r) => r.name ?? "").filter(Boolean)
    : [];
  const cities = Array.isArray(gl.cities)
    ? (gl.cities as Array<{ name?: string }>).map((c) => c.name ?? "").filter(Boolean)
    : [];

  const interests = Array.isArray(t.interests) ? (t.interests as unknown[]) : [];
  const behaviors = Array.isArray(t.behaviors) ? (t.behaviors as unknown[]) : [];
  const customAudiences = Array.isArray(t.custom_audiences)
    ? (t.custom_audiences as unknown[])
    : [];
  const locales = Array.isArray(t.locales) ? (t.locales as number[]) : [];

  return {
    age_min: typeof t.age_min === "number" ? t.age_min : null,
    age_max: typeof t.age_max === "number" ? t.age_max : null,
    genders,
    geo_countries: countries,
    geo_regions: regions,
    geo_cities: cities,
    interests_count: interests.length,
    behaviors_count: behaviors.length,
    custom_audiences_count: customAudiences.length,
    raw_locales: locales,
  };
}

/**
 * Busca adsets de uma campanha com metadados completos.
 */
export async function fetchAdsets(accessToken: string, campaignId: string): Promise<MetaAdsetRow[]> {
  const fields = [
    "name",
    "status",
    "campaign_id",
    "daily_budget",
    "lifetime_budget",
    "bid_strategy",
    "optimization_goal",
    "billing_event",
    "targeting",
    "start_time",
    "end_time",
  ].join(",");

  const raw = await fetchJson(
    `${META_API}/${campaignId}/adsets?fields=${fields}&limit=100&access_token=${accessToken}`
  );
  const items = parseMetaList(AdsetDetailListResponse, raw, `adsets_detail(${campaignId})`);

  return items.map((a) => ({
    adset_id: a.id,
    adset_name: a.name,
    campaign_id: campaignId,
    status: a.status ?? null,
    daily_budget: centsToReais(a.daily_budget ?? null),
    lifetime_budget: centsToReais(a.lifetime_budget ?? null),
    bid_strategy: a.bid_strategy ?? null,
    optimization_goal: a.optimization_goal ?? null,
    billing_event: a.billing_event ?? null,
    targeting: summarizeTargeting(a.targeting),
    start_time: a.start_time ?? null,
    end_time: a.end_time ?? null,
    raw: a,
  }));
}

export async function fetchCampaigns(accessToken: string, adAccountId: string): Promise<MetaAdData[]> {
  const results: MetaAdData[] = [];

  const campaignsRaw = await fetchJson(
    `${META_API}/${adAccountId}/campaigns?fields=name,status,objective,daily_budget&limit=100&access_token=${accessToken}`
  );
  const campaigns = parseMetaList(CampaignListResponse, campaignsRaw, `campaigns(${adAccountId})`);

  for (const campaign of campaigns) {
    const adsetsRaw = await fetchJson(
      `${META_API}/${campaign.id}/adsets?fields=name,status&limit=100&access_token=${accessToken}`
    );
    const adsets = parseMetaList(AdsetListResponse, adsetsRaw, `adsets(${campaign.id})`);

    for (const adset of adsets) {
      const adsRaw = await fetchJson(
        `${META_API}/${adset.id}/ads?fields=name,status,creative{object_type}&limit=100&access_token=${accessToken}`
      );
      const ads = parseMetaList(AdListResponse, adsRaw, `ads(${adset.id})`);

      const dailyBudget =
        campaign.daily_budget != null ? Number(campaign.daily_budget) / 100 : null;

      for (const ad of ads) {
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          adset_id: adset.id,
          adset_name: adset.name,
          ad_id: ad.id,
          ad_name: ad.name,
          creative_type: ad.creative?.object_type ?? null,
          status: ad.status ?? "UNKNOWN",
          daily_budget: Number.isFinite(dailyBudget) ? dailyBudget : null,
          objective: campaign.objective ?? null,
        });
      }
    }
  }

  return results;
}
