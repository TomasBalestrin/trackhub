import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendCAPIEvent } from "@/lib/meta/capi";

// Allow CORS for external sites using tracker.js
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    // Handle sendBeacon (text/plain) and fetch (application/json)
    let body;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("text/plain")) {
      const text = await request.text();
      body = JSON.parse(text);
    } else {
      body = await request.json();
    }

    const {
      event_name,
      event_id,
      fbclid,
      fbc,
      fbp,
      url,
      referrer,
      user_agent: clientUA,
      user_data,
      utm_data,
      extra,
    } = body;

    if (!event_name || !event_id) {
      return NextResponse.json({ error: "Missing event_name or event_id" }, { status: 400, headers: CORS_HEADERS });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") || null;
    const userAgent = clientUA || request.headers.get("user-agent") || null;

    const supabase = createServiceClient();

    // Upsert garante idempotência: retries/duplicações com mesmo event_id
    // não geram linhas duplicadas (UNIQUE INDEX em tracking_events.event_id).
    await supabase.from("tracking_events").upsert(
      {
        event_name,
        event_id,
        event_source: "server",
        event_time: new Date().toISOString(),
        fbclid: fbclid || utm_data?.fbclid || null,
        fbc: fbc || null,
        fbp: fbp || null,
        ip_address: ip,
        user_agent: userAgent,
        payload: {
          ...(user_data || {}),
          ...(utm_data || {}),
          ...(extra || {}),
          url: url || null,
          referrer: referrer || null,
        },
      },
      { onConflict: "event_id", ignoreDuplicates: true }
    );

    // Send to CAPI (async)
    sendCAPIEvent({
      event_name,
      event_id,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: url || process.env.NEXT_PUBLIC_BASE_URL || "",
      user_data: {
        email: user_data?.em || undefined,
        phone: user_data?.ph || undefined,
        first_name: user_data?.fn || undefined,
        last_name: user_data?.ln || undefined,
        client_ip_address: ip || undefined,
        client_user_agent: userAgent || undefined,
        fbc,
        fbp,
      },
    }).catch((err) => console.error("CAPI tracking error:", err));

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Tracking API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS_HEADERS });
  }
}
