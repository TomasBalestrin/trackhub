import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";

const META_API_BASE = "https://graph.facebook.com/v21.0";
const MAX_RESULTS = 500;
const DEFAULT_LIMIT = 100;

type InsightType =
  | "overview"
  | "campaigns"
  | "ads"
  | "hourly"
  | "demographics"
  | "placements"
  | "regions"
  | "daily";

interface TypeConfig {
  level: string;
  fields: string;
  breakdowns?: string;
  time_increment?: string;
}

const TYPE_CONFIGS: Record<InsightType, TypeConfig> = {
  overview: {
    level: "account",
    fields:
      "impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,cost_per_action_type",
  },
  campaigns: {
    level: "campaign",
    fields:
      "campaign_name,campaign_id,impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,cost_per_action_type",
  },
  ads: {
    level: "ad",
    fields:
      "ad_name,ad_id,adset_name,campaign_name,impressions,clicks,spend,cpc,ctr,reach,actions,cost_per_action_type,quality_ranking,engagement_rate_ranking,conversion_rate_ranking",
  },
  hourly: {
    level: "account",
    fields: "impressions,clicks,spend,actions",
    breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
  },
  demographics: {
    level: "campaign",
    fields:
      "campaign_name,impressions,clicks,spend,actions,cost_per_action_type",
    breakdowns: "age,gender",
  },
  placements: {
    level: "campaign",
    fields: "campaign_name,impressions,clicks,spend,actions",
    breakdowns: "publisher_platform,platform_position",
  },
  regions: {
    level: "account",
    fields: "impressions,clicks,spend,actions",
    breakdowns: "region",
  },
  daily: {
    level: "account",
    fields: "impressions,clicks,spend,actions,cost_per_action_type",
    time_increment: "1",
  },
};

const VALID_DATE_PRESETS = ["today", "last_7d", "last_14d", "last_30d"];

function extractLeadCount(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;
  const lead = actions.find((a) => a.action_type === "lead");
  return lead ? parseInt(lead.value, 10) : 0;
}

function extractCostPerLead(
  costPerActionType?: Array<{ action_type: string; value: string }>
): number {
  if (!costPerActionType) return 0;
  const lead = costPerActionType.find((a) => a.action_type === "lead");
  return lead ? parseFloat(lead.value) : 0;
}

function computeSummary(data: Array<Record<string, unknown>>) {
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalSpend = 0;
  let totalReach = 0;
  let totalLeads = 0;
  let totalCostPerLead = 0;
  let leadEntries = 0;

  for (const row of data) {
    totalImpressions += parseInt((row.impressions as string) || "0", 10);
    totalClicks += parseInt((row.clicks as string) || "0", 10);
    totalSpend += parseFloat((row.spend as string) || "0");
    totalReach += parseInt((row.reach as string) || "0", 10);

    const leads = extractLeadCount(
      row.actions as Array<{ action_type: string; value: string }> | undefined
    );
    totalLeads += leads;

    const cpl = extractCostPerLead(
      row.cost_per_action_type as
        | Array<{ action_type: string; value: string }>
        | undefined
    );
    if (cpl > 0) {
      totalCostPerLead += cpl;
      leadEntries++;
    }
  }

  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const avgCostPerLead =
    totalLeads > 0 ? totalSpend / totalLeads : leadEntries > 0 ? totalCostPerLead / leadEntries : 0;

  return {
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    total_spend: parseFloat(totalSpend.toFixed(2)),
    total_reach: totalReach,
    total_leads: totalLeads,
    avg_cpc: parseFloat(avgCpc.toFixed(2)),
    avg_ctr: parseFloat(avgCtr.toFixed(2)),
    avg_cpm: parseFloat(avgCpm.toFixed(2)),
    avg_cost_per_lead: parseFloat(avgCostPerLead.toFixed(2)),
    rows_count: data.length,
  };
}

async function fetchAllPages(url: string, accessToken: string): Promise<Array<Record<string, unknown>>> {
  const allData: Array<Record<string, unknown>> = [];

  // First request: we build the URL with the access token
  let fetchUrl: string | null = `${url}&access_token=${accessToken}`;

  while (fetchUrl && allData.length < MAX_RESULTS) {
    const response: Response = await fetch(fetchUrl);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Meta API error (${response.status}): ${errorBody}`);
    }

    const json = await response.json();

    if (json.data && Array.isArray(json.data)) {
      allData.push(...json.data);
    }

    // Meta's pagination next URL already includes all params + access token
    fetchUrl = json.paging?.next || null;
  }

  return allData.slice(0, MAX_RESULTS);
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;

    if (!accessToken || !adAccountId) {
      return NextResponse.json(
        { error: "Missing META_CAPI_ACCESS_TOKEN or META_AD_ACCOUNT_ID environment variables" },
        { status: 500 }
      );
    }

    const { searchParams } = request.nextUrl;
    const type = (searchParams.get("type") || "overview") as InsightType;
    const datePreset = searchParams.get("date_preset") || "last_7d";
    const campaignFilter = searchParams.get("campaign_filter");

    if (!TYPE_CONFIGS[type]) {
      return NextResponse.json(
        { error: `Invalid type: ${type}. Must be one of: ${Object.keys(TYPE_CONFIGS).join(", ")}` },
        { status: 400 }
      );
    }

    if (!VALID_DATE_PRESETS.includes(datePreset)) {
      return NextResponse.json(
        { error: `Invalid date_preset: ${datePreset}. Must be one of: ${VALID_DATE_PRESETS.join(", ")}` },
        { status: 400 }
      );
    }

    const config = TYPE_CONFIGS[type];

    const params = new URLSearchParams({
      level: config.level,
      fields: config.fields,
      date_preset: datePreset,
      limit: String(DEFAULT_LIMIT),
    });

    if (config.breakdowns) {
      params.set("breakdowns", config.breakdowns);
    }

    if (config.time_increment) {
      params.set("time_increment", config.time_increment);
    }

    if (campaignFilter) {
      const filtering = JSON.stringify([
        {
          field: "campaign.name",
          operator: "CONTAIN",
          value: campaignFilter,
        },
      ]);
      params.set("filtering", filtering);
    }

    const url = `${META_API_BASE}/${adAccountId}/insights?${params.toString()}`;

    const data = await fetchAllPages(url, accessToken);

    // Enrich each row with extracted lead data
    const enrichedData = data.map((row) => {
      const leads = extractLeadCount(
        row.actions as Array<{ action_type: string; value: string }> | undefined
      );
      const costPerLead = extractCostPerLead(
        row.cost_per_action_type as
          | Array<{ action_type: string; value: string }>
          | undefined
      );
      return {
        ...row,
        leads,
        cost_per_lead: costPerLead,
      };
    });

    const summary = computeSummary(data);

    return NextResponse.json({
      type,
      date_preset: datePreset,
      campaign_filter: campaignFilter || null,
      data: enrichedData,
      summary,
    });
  } catch (error) {
    log.error({ err: error, route: "/api/admin/insights" }, "insights handler failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
