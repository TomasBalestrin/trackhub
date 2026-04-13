import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/leads/enrich
 *
 * Re-enriquece leads que foram criados sem dados Meta Ads.
 * Para cada lead sem campaign_name, busca na tracking_cache (se ainda existir)
 * e na meta_campaigns_cache (usando UTMs como fallback).
 */
export async function POST() {
  const supabase = createServiceClient();

  // Buscar leads sem dados Meta (campaign_name é o indicador principal)
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("id, email, utm_campaign, utm_content, utm_term, utm_source, utm_medium, campaign_name, ad_name, adset_name, fbclid, fbc, fbp")
    .is("campaign_name", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ message: "No leads to enrich", enriched: 0 });
  }

  // Carregar toda a meta_campaigns_cache para matching
  const { data: campaigns } = await supabase
    .from("meta_campaigns_cache")
    .select("campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, creative_type");

  let enriched = 0;
  const results: Array<{ id: string; email: string; source: string; fields: string[] }> = [];

  for (const lead of leads) {
    const updates: Record<string, string | null> = {};
    let enrichSource = "";

    // Tentativa 1: Buscar na tracking_cache (pode ainda existir se lead foi importado manualmente)
    const { data: cached } = await supabase
      .from("tracking_cache")
      .select("id, tracking_data")
      .eq("email", lead.email)
      .order("created_at", { ascending: false })
      .limit(1);

    if (cached && cached.length > 0) {
      const td = cached[0].tracking_data as Record<string, string>;
      enrichSource = "tracking_cache";

      if (td.campaign_name) updates.campaign_name = td.campaign_name;
      if (td.ad_name) updates.ad_name = td.ad_name;
      if (td.adset_name) updates.adset_name = td.adset_name;
      if (td.creative_type) updates.creative_type = td.creative_type;
      if (td.ad_id) updates.ad_id = td.ad_id;
      if (td.adset_id) updates.adset_id = td.adset_id;
      if (td.campaign_id) updates.campaign_id = td.campaign_id;
      if (td.fbclid && !lead.fbclid) updates.fbclid = td.fbclid;
      if (td.fbc && !lead.fbc) updates.fbc = td.fbc;
      if (td.fbp && !lead.fbp) updates.fbp = td.fbp;
      if (td.utm_source && !lead.utm_source) updates.utm_source = td.utm_source;
      if (td.utm_medium && !lead.utm_medium) updates.utm_medium = td.utm_medium;
      if (td.utm_campaign && !lead.utm_campaign) updates.utm_campaign = td.utm_campaign;
      if (td.utm_content && !lead.utm_content) updates.utm_content = td.utm_content;
      if (td.utm_term && !lead.utm_term) updates.utm_term = td.utm_term;
    }

    // Tentativa 2: Se ainda não tem campaign_name, tentar casar UTMs com meta_campaigns_cache
    if (!updates.campaign_name && campaigns && campaigns.length > 0) {
      const utmCampaign = lead.utm_campaign || updates.utm_campaign;
      const utmContent = lead.utm_content || updates.utm_content;
      const utmTerm = lead.utm_term || updates.utm_term;

      // Tentar match por campaign_name (utm_campaign) + ad_name (utm_content)
      let match = null;
      if (utmCampaign && utmContent) {
        match = campaigns.find(
          (c) => c.campaign_name === utmCampaign && c.ad_name === utmContent
        );
      }
      if (!match && utmCampaign) {
        match = campaigns.find((c) => c.campaign_name === utmCampaign);
      }

      if (match) {
        enrichSource = "meta_campaigns_cache";
        if (!updates.campaign_name) updates.campaign_name = match.campaign_name;
        if (!updates.campaign_id) updates.campaign_id = match.campaign_id;
        if (!updates.ad_name && match.ad_name) updates.ad_name = match.ad_name;
        if (!updates.ad_id && match.ad_id) updates.ad_id = match.ad_id;
        if (!updates.adset_name && match.adset_name) updates.adset_name = match.adset_name;
        if (!updates.adset_id && match.adset_id) updates.adset_id = match.adset_id;
        if (!updates.creative_type && match.creative_type) updates.creative_type = match.creative_type;
      }
    }

    // Tentativa 3: Fallback - usar UTMs diretamente como nomes Meta
    if (!updates.campaign_name && lead.utm_campaign) {
      updates.campaign_name = lead.utm_campaign;
      enrichSource = "utm_fallback";
    }
    if (!updates.ad_name && lead.utm_content) {
      updates.ad_name = lead.utm_content;
    }
    if (!updates.adset_name && lead.utm_term) {
      updates.adset_name = lead.utm_term;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", lead.id);

      if (!error) {
        enriched++;
        results.push({
          id: lead.id,
          email: lead.email,
          source: enrichSource,
          fields: Object.keys(updates),
        });
      }
    }
  }

  return NextResponse.json({ enriched, total: leads.length, results });
}
