import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { leadFormSchema } from "@/lib/lead/validation";
import { calculateQualificationScore } from "@/lib/lead/qualification";
import { sendCAPIEvent } from "@/lib/meta/capi";
import { log } from "@/lib/log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = leadFormSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dados inválidos";
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const data = parsed.data;
    const supabase = createServiceClient();

    // Get IP and User Agent from request
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") || null;
    const userAgent = data.user_agent || request.headers.get("user-agent") || null;

    // Calculate qualification score
    const qualificationScore = calculateQualificationScore({
      monthly_income: data.monthly_income,
      how_found: data.how_found,
      city: data.city,
      state: data.state,
    });

    // Insert lead
    const { data: lead, error: insertError } = await supabase
      .from("leads")
      .insert({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone.replace(/\D/g, ""),
        monthly_income: data.monthly_income,
        city: data.city,
        state: data.state,
        how_found: data.how_found,
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
        utm_campaign: data.utm_campaign || null,
        utm_content: data.utm_content || null,
        utm_term: data.utm_term || null,
        fbclid: data.fbclid || null,
        fbc: data.fbc || null,
        fbp: data.fbp || null,
        ad_name: data.ad_name || null,
        adset_name: data.adset_name || null,
        campaign_name: data.campaign_name || null,
        creative_type: data.creative_type || null,
        ad_id: data.ad_id || null,
        adset_id: data.adset_id || null,
        campaign_id: data.campaign_id || null,
        landing_page_url: data.landing_page_url || null,
        referrer: data.referrer || null,
        user_agent: userAgent,
        ip_address: ip,
        lead_at: new Date().toISOString(),
        qualification_score: qualificationScore,
        event_id_lead: body.event_id_lead || null,
        event_id_complete_registration: body.event_id_complete_registration || null,
      })
      .select("id")
      .single();

    if (insertError) {
      log.error({ err: insertError, route: "/api/lead", phase: "insert" }, "lead insert failed");
      return NextResponse.json(
        { success: false, error: "Erro ao salvar dados. Tente novamente." },
        { status: 500 }
      );
    }

    // Insert tracking event + dispatch CAPI only when client passed event_id_lead.
    // Sem event_id_lead, o Pixel-side fire teria id diferente — melhor pular CAPI
    // do que gerar id órfão que quebra a deduplicação.
    if (body.event_id_lead) {
      await supabase
        .from("tracking_events")
        .upsert(
          {
            lead_id: lead.id,
            event_name: "Lead",
            event_id: body.event_id_lead,
            event_source: "server",
            event_time: new Date().toISOString(),
            fbclid: data.fbclid || null,
            fbc: data.fbc || null,
            fbp: data.fbp || null,
            ip_address: ip,
            user_agent: userAgent,
            payload: {
              monthly_income: data.monthly_income,
              qualification_score: qualificationScore,
            },
          },
          { onConflict: "event_id", ignoreDuplicates: true }
        );

      const nameParts = data.full_name.trim().split(/\s+/);
      sendCAPIEvent({
        event_name: "Lead",
        event_id: body.event_id_lead,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: data.landing_page_url || process.env.NEXT_PUBLIC_BASE_URL || "",
        user_data: {
          email: data.email,
          phone: data.phone,
          first_name: nameParts[0],
          last_name: nameParts.slice(1).join(" "),
          city: data.city,
          state: data.state,
          client_ip_address: ip || undefined,
          client_user_agent: userAgent || undefined,
          fbc: data.fbc,
          fbp: data.fbp,
        },
        custom_data: {
          currency: "BRL",
          value: 0,
          content_name: "Aula ao Vivo",
          content_category: "lead_capture",
          qualification_score: qualificationScore,
        },
      }).catch((err) => log.error({ err, route: "/api/lead", phase: "capi" }, "CAPI Lead failed"));
    } else {
      log.warn({ lead_id: lead.id, route: "/api/lead" }, "lead without event_id_lead, CAPI skipped");
    }

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error) {
    log.error({ err: error, route: "/api/lead" }, "lead handler unexpected error");
    return NextResponse.json(
      { success: false, error: "Erro interno. Tente novamente." },
      { status: 500 }
    );
  }
}
