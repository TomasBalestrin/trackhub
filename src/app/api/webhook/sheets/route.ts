import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { calculateQualificationScore } from "@/lib/lead/qualification";
import { log } from "@/lib/log";

/**
 * Webhook para receber leads do Google Sheets (via Google Apps Script)
 *
 * POST /api/webhook/sheets
 * Headers: { "x-webhook-secret": "seu_cron_secret" }
 * Body: {
 *   full_name: "Nome Completo",
 *   email: "email@example.com",
 *   phone: "11999999999",
 *   monthly_income: "5000_10000",
 *   city: "São Paulo",
 *   state: "SP",
 *   how_found: "instagram",
 *   source: "site-a",  // identificador do site/planilha de origem
 *   // UTM params (opcionais - vem dos hidden fields do formulario)
 *   utm_source: "facebook",
 *   utm_campaign: "aula_abril",
 *   fbclid: "abc123",
 *   ad_name: "Video_V2",
 *   campaign_name: "Aula Abril",
 *   adset_name: "Interesse_Financas",
 *   creative_type: "video",
 *   fbc: "fb.1.xxx",
 *   fbp: "fb.1.xxx",
 *   // Metadados do tracker.js
 *   tracker_url: "https://seusite.com/landing",
 *   tracker_referrer: "https://facebook.com"
 * }
 */
export async function POST(request: NextRequest) {
  // Verify webhook secret
  const secret = request.headers.get("x-webhook-secret")?.trim();
  // Prefer dedicated WEBHOOK_SECRET; fall back to CRON_SECRET for backward compat during migration.
  const expectedSecret = (process.env.WEBHOOK_SECRET ?? process.env.CRON_SECRET)?.trim();

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Suporta tanto um lead quanto um array de leads
    const leads = Array.isArray(body) ? body : [body];
    const supabase = createServiceClient();
    const results = [];

    for (const lead of leads) {
      if (!lead.full_name || !lead.email || !lead.phone) {
        results.push({ error: "Missing required fields", lead: lead.email || "unknown" });
        continue;
      }

      // Check duplicate by email
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("email", lead.email.toLowerCase().trim())
        .limit(1);

      if (existing && existing.length > 0) {
        results.push({ skipped: true, reason: "duplicate", email: lead.email });
        continue;
      }

      // Buscar dados de tracking da cache (enviados pelo tracker.js no momento do form submit)
      const emailNormalized = lead.email.toLowerCase().trim();
      const { data: cached } = await supabase
        .from("tracking_cache")
        .select("id, tracking_data")
        .eq("email", emailNormalized)
        .order("created_at", { ascending: false })
        .limit(1);

      const hasCachedData = cached && cached.length > 0;
      const trackData = (hasCachedData ? cached[0].tracking_data : {}) as Record<string, string>;

      // Fallback: parse UTMs from landing_page_url when fields are null
      // (handles iOS Instagram WebView where sessionStorage may fail)
      let urlUtms: Record<string, string> = {};
      if (hasCachedData && trackData.landing_page_url) {
        try {
          const url = new URL(trackData.landing_page_url);
          for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"]) {
            const val = url.searchParams.get(key);
            if (val) urlUtms[key] = val;
          }
        } catch { /* invalid URL, ignore */ }
      }

      log.info(
        {
          email: emailNormalized,
          tracking_cache: hasCachedData ? "hit" : "miss",
          cache_keys: hasCachedData
            ? Object.keys(trackData).filter((k) => trackData[k])
            : [],
          url_fallback_keys: Object.keys(urlUtms),
          route: "/api/webhook/sheets",
        },
        "lead ingested"
      );

      // Resolve UTM values (lead data > cache > url fallback > null)
      const utmSource = lead.utm_source || trackData.utm_source || urlUtms.utm_source || null;
      const utmMedium = lead.utm_medium || trackData.utm_medium || urlUtms.utm_medium || null;
      const utmCampaign = lead.utm_campaign || trackData.utm_campaign || urlUtms.utm_campaign || null;
      const utmContent = lead.utm_content || trackData.utm_content || urlUtms.utm_content || null;
      const utmTerm = lead.utm_term || trackData.utm_term || urlUtms.utm_term || null;

      // Map UTMs to Meta Ads attribution when direct fields are empty
      const campaignName = lead.campaign_name || trackData.campaign_name || utmCampaign || null;
      const adName = lead.ad_name || trackData.ad_name || utmContent || null;
      const adsetName = lead.adset_name || trackData.adset_name || utmTerm || null;

      const qualificationScore = calculateQualificationScore({
        monthly_income: lead.monthly_income || null,
        how_found: lead.how_found || null,
        city: lead.city || null,
        state: lead.state || null,
      });

      const { data: inserted, error } = await supabase
        .from("leads")
        .insert({
          full_name: lead.full_name,
          email: emailNormalized,
          phone: (lead.phone || "").replace(/\D/g, ""),
          monthly_income: lead.monthly_income || null,
          city: lead.city || null,
          state: lead.state || null,
          how_found: lead.how_found || null,
          // Prefer tracker.js source (accurate per landing page) over Apps Script hardcoded SOURCE
          source: trackData.source || lead.source || null,
          position: lead.position || null,
          // UTM data: prefer lead data (from Apps Script), fallback to tracking cache
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_term: utmTerm,
          fbclid: lead.fbclid || trackData.fbclid || urlUtms.fbclid || null,
          fbc: lead.fbc || trackData.fbc || null,
          fbp: lead.fbp || trackData.fbp || null,
          ad_name: adName,
          adset_name: adsetName,
          campaign_name: campaignName,
          creative_type: lead.creative_type || trackData.creative_type || null,
          ad_id: lead.ad_id || trackData.ad_id || null,
          adset_id: lead.adset_id || trackData.adset_id || null,
          campaign_id: lead.campaign_id || trackData.campaign_id || null,
          landing_page_url: lead.tracker_url || trackData.landing_page_url || null,
          referrer: lead.tracker_referrer || trackData.referrer || null,
          user_agent: trackData.user_agent || null,
          qualification_score: qualificationScore,
          lead_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      // Limpar cache após uso
      if (cached && cached.length > 0) {
        await supabase.from("tracking_cache").delete().eq("id", cached[0].id);
      }

      if (error) {
        results.push({ error: error.message, email: lead.email });
      } else {
        // Vincular eventos de tracking ao lead e preencher timestamps de conversão
        const leadFbc = lead.fbc || trackData.fbc || null;
        const leadFbp = lead.fbp || trackData.fbp || null;

        if (leadFbc || leadFbp) {
          // Buscar eventos recentes com mesmo fbc/fbp (últimas 24h)
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          let eventsQuery = supabase
            .from("tracking_events")
            .select("id, event_name, event_time, event_id")
            .is("lead_id", null)
            .gte("created_at", since);

          if (leadFbc) {
            eventsQuery = eventsQuery.eq("fbc", leadFbc);
          } else if (leadFbp) {
            eventsQuery = eventsQuery.eq("fbp", leadFbp);
          }

          const { data: events } = await eventsQuery.order("event_time", { ascending: true });

          if (events && events.length > 0) {
            // Vincular todos os eventos ao lead
            const eventIds = events.map((e) => e.id);
            await supabase
              .from("tracking_events")
              .update({ lead_id: inserted.id })
              .in("id", eventIds);

            // Preencher timestamps de conversão no lead
            const timestamps: Record<string, string> = {};
            const eventIdFields: Record<string, string> = {};

            for (const event of events) {
              if (event.event_name === "PageView" && !timestamps.page_view_at) {
                timestamps.page_view_at = event.event_time;
                eventIdFields.event_id_page_view = event.event_id;
              } else if (event.event_name === "ViewContent" && !timestamps.view_content_at) {
                timestamps.view_content_at = event.event_time;
                eventIdFields.event_id_view_content = event.event_id;
              } else if (event.event_name === "Lead" && !timestamps.lead_at) {
                timestamps.lead_at = event.event_time;
                eventIdFields.event_id_lead = event.event_id;
              } else if (event.event_name === "CompleteRegistration" && !timestamps.complete_registration_at) {
                timestamps.complete_registration_at = event.event_time;
                eventIdFields.event_id_complete_registration = event.event_id;
              }
            }

            if (Object.keys(timestamps).length > 0) {
              await supabase
                .from("leads")
                .update({ ...timestamps, ...eventIdFields })
                .eq("id", inserted.id);
            }
          }
        }

        results.push({ success: true, id: inserted.id, email: lead.email });
      }
    }

    return NextResponse.json({ results, total: leads.length });
  } catch (error) {
    log.error({ err: error, route: "/api/webhook/sheets" }, "webhook sheets failed");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
