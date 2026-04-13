import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchCampaigns } from "@/lib/meta/marketing-api";
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

    let upserted = 0;
    for (const campaign of campaigns) {
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

      if (!error) upserted++;
    }

    return NextResponse.json({
      success: true,
      total: campaigns.length,
      upserted,
    });
  } catch (error) {
    log.error({ err: error, route: "cron/sync-campaigns" }, "campaign sync failed");
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
