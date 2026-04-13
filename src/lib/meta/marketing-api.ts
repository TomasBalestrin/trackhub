import {
  AdListResponse,
  AdsetListResponse,
  CampaignListResponse,
  parseMetaList,
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

const META_API = "https://graph.facebook.com/v21.0";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  return res.json();
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
