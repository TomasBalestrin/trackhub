import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAdsets, fetchCampaigns } from "@/lib/meta/marketing-api";
import { log } from "@/lib/log";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader?.trim() !== `Bearer ${cronSecret.trim()}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return NextResponse.json({ error: "Missing Meta API credentials" }, { status: 500 });
  }

  try {
    const campaigns = await fetchCampaigns(accessToken, adAccountId);
    const supabase = createServiceClient();

    let adsUpserted = 0;
    const campaignIds = new Set<string>();
    for (const campaign of campaigns) {
      campaignIds.add(campaign.campaign_id);
      const { error } = await supabase
        .from("meta_campaigns_cache")
        .upsert(
          {
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            adset_id: campaign.adset_id,
            adset_name: campaign.adset_name,
            ad_id: campaign.ad_id,
            ad_name: campaign.ad_name,
            creative_type: campaign.creative_type,
            status: campaign.status,
            daily_budget: campaign.daily_budget,
            objective: campaign.objective,
            updated_at: new Date().toISOString(),
            raw_data: campaign as unknown as Record<string, unknown>,
          },
          { onConflict: "ad_id" }
        );

      if (!error) adsUpserted++;
    }

    // Sync adsets (metadados de configuração por conjunto). Independente do
    // sync de ads acima — uma call a /adsets por campanha.
    let adsetsUpserted = 0;
    for (const cid of campaignIds) {
      try {
        const adsets = await fetchAdsets(accessToken, cid);
        for (const a of adsets) {
          const { error } = await supabase.from("meta_adsets_cache").upsert(
            {
              adset_id: a.adset_id,
              adset_name: a.adset_name,
              campaign_id: a.campaign_id,
              status: a.status,
              daily_budget: a.daily_budget,
              lifetime_budget: a.lifetime_budget,
              bid_strategy: a.bid_strategy,
              optimization_goal: a.optimization_goal,
              billing_event: a.billing_event,
              targeting: a.targeting,
              start_time: a.start_time,
              end_time: a.end_time,
              raw_data: a.raw as unknown as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "adset_id" }
          );
          if (!error) adsetsUpserted++;
        }
      } catch (err) {
        log.error(
          { err, campaign_id: cid, route: "cron/sync-campaigns" },
          "adsets sync failed for campaign"
        );
      }
    }

    return NextResponse.json({
      success: true,
      ads_total: campaigns.length,
      ads_upserted: adsUpserted,
      adsets_upserted: adsetsUpserted,
      campaigns_discovered: campaignIds.size,
    });
  } catch (error) {
    log.error({ err: error, route: "cron/sync-campaigns" }, "campaign sync failed");
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
