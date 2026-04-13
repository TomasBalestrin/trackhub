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

export async function fetchCampaigns(accessToken: string, adAccountId: string): Promise<MetaAdData[]> {
  const results: MetaAdData[] = [];

  const campaignsRes = await fetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?fields=name,status,objective,daily_budget&limit=100&access_token=${accessToken}`
  );
  const campaignsData = await campaignsRes.json();

  if (!campaignsData.data) return results;

  for (const campaign of campaignsData.data) {
    const adsetsRes = await fetch(
      `https://graph.facebook.com/v21.0/${campaign.id}/adsets?fields=name,status&limit=100&access_token=${accessToken}`
    );
    const adsetsData = await adsetsRes.json();

    for (const adset of adsetsData.data || []) {
      const adsRes = await fetch(
        `https://graph.facebook.com/v21.0/${adset.id}/ads?fields=name,status,creative{object_type}&limit=100&access_token=${accessToken}`
      );
      const adsData = await adsRes.json();

      for (const ad of adsData.data || []) {
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          adset_id: adset.id,
          adset_name: adset.name,
          ad_id: ad.id,
          ad_name: ad.name,
          creative_type: ad.creative?.object_type || null,
          status: ad.status,
          daily_budget: campaign.daily_budget ? Number(campaign.daily_budget) / 100 : null,
          objective: campaign.objective || null,
        });
      }
    }
  }

  return results;
}
