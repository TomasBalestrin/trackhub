import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

/**
 * Recebe dados de tracking do tracker.js quando um formulário é submetido.
 * Armazena temporariamente para enriquecer o lead quando chegar via webhook.
 *
 * POST /api/tracking/enrich
 * Body: { email, utm_source, utm_medium, utm_campaign, fbclid, fbc, fbp, ad_name, ... }
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("text/plain")) {
      const text = await request.text();
      body = JSON.parse(text);
    } else {
      body = await request.json();
    }

    const { email, ...trackingData } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Missing email" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = createServiceClient();

    // Upsert: se já existe cache para esse email, atualiza
    const { data: existing } = await supabase
      .from("tracking_cache")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from("tracking_cache")
        .update({
          tracking_data: trackingData,
          created_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id);
    } else {
      await supabase.from("tracking_cache").insert({
        email: email.toLowerCase().trim(),
        tracking_data: trackingData,
      });
    }

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Tracking enrich error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
