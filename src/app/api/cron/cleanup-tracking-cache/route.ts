import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

// Remove entradas de tracking_cache com mais de 7 dias.
// O TTL está documentado na migration que cria a tabela; este cron apenas
// executa a política. Disparado por Vercel Cron (daily) com Authorization
// Bearer ${CRON_SECRET}.

const TTL_DAYS = 7;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (cronSecret && authHeader?.trim() !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  const { error, count } = await supabase
    .from("tracking_cache")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) {
    log.error(
      { err: error, route: "/api/cron/cleanup-tracking-cache", cutoff },
      "tracking_cache cleanup failed"
    );
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }

  log.info(
    { route: "/api/cron/cleanup-tracking-cache", deleted: count ?? 0, cutoff, ttl_days: TTL_DAYS },
    "tracking_cache cleanup ok"
  );

  return NextResponse.json({ success: true, deleted: count ?? 0, cutoff, ttl_days: TTL_DAYS });
}
