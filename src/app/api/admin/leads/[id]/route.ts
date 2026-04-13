import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const [leadRes, eventsRes] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).single(),
    supabase
      .from("tracking_events")
      .select("*")
      .eq("lead_id", id)
      .order("event_time", { ascending: true }),
  ]);

  if (leadRes.error) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({
    lead: leadRes.data,
    events: eventsRes.data || [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("leads")
    .update({ status: body.status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
