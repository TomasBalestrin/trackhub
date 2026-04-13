import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServiceClient();

  const { data: cache } = await supabase
    .from("tracking_cache")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: events } = await supabase
    .from("tracking_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ cache: cache || [], events: events || [] });
}

export async function DELETE(request: NextRequest) {
  const { ids } = await request.json();
  if (!ids || !Array.isArray(ids)) {
    return NextResponse.json({ error: "Missing ids array" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Delete tracking events linked to these leads
  await supabase.from("tracking_events").delete().in("lead_id", ids);

  // Delete the leads
  const { error, count } = await supabase.from("leads").delete().in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clean up tracking cache
  await supabase.from("tracking_cache").delete().lt("created_at", new Date().toISOString());

  return NextResponse.json({ success: true, deleted: count || ids.length });
}
