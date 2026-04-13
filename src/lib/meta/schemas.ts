import { z } from "zod";
import { log } from "@/lib/log";

// Zod schemas para validar respostas do Meta Graph API v21.0.
// Se o shape mudar (breaking change silencioso do Meta), parse falha em vez
// de estourar em KPI via type assertion. Endereça CONCERNS C10.

const MetaListEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item).optional().default([]),
    paging: z.unknown().optional(),
  });

const CampaignItem = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
  objective: z.string().nullable().optional(),
  // daily_budget vem como string em centavos
  daily_budget: z.union([z.string(), z.number()]).nullable().optional(),
});
export type CampaignItem = z.infer<typeof CampaignItem>;
export const CampaignListResponse = MetaListEnvelope(CampaignItem);

const AdsetItem = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
});
export type AdsetItem = z.infer<typeof AdsetItem>;
export const AdsetListResponse = MetaListEnvelope(AdsetItem);

// Shape estendido usado pelo sync (campos extras pra meta_adsets_cache).
// Fields no request: name,status,daily_budget,lifetime_budget,bid_strategy,
// optimization_goal,billing_event,targeting,start_time,end_time
const AdsetDetailItem = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
  daily_budget: z.union([z.string(), z.number()]).nullable().optional(),
  lifetime_budget: z.union([z.string(), z.number()]).nullable().optional(),
  bid_strategy: z.string().nullable().optional(),
  optimization_goal: z.string().nullable().optional(),
  billing_event: z.string().nullable().optional(),
  targeting: z.unknown().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
});
export type AdsetDetailItem = z.infer<typeof AdsetDetailItem>;
export const AdsetDetailListResponse = MetaListEnvelope(AdsetDetailItem);

// Insights por adset (level=adset).
const AdsetInsightItem = z.object({
  adset_id: z.string().optional(),
  adset_name: z.string().optional(),
  campaign_id: z.string().optional(),
  impressions: z.string().optional(),
  clicks: z.string().optional(),
  spend: z.string().optional(),
  cpc: z.string().optional(),
  ctr: z.string().optional(),
  reach: z.string().optional(),
  actions: z.array(z.object({ action_type: z.string(), value: z.string() })).optional(),
  cost_per_action_type: z.array(z.object({ action_type: z.string(), value: z.string() })).optional(),
});
export type AdsetInsightItem = z.infer<typeof AdsetInsightItem>;
export const AdsetInsightListResponse = MetaListEnvelope(AdsetInsightItem);

const AdItem = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
  creative: z
    .object({
      object_type: z.string().optional(),
    })
    .optional(),
});
export type AdItem = z.infer<typeof AdItem>;
export const AdListResponse = MetaListEnvelope(AdItem);

/**
 * Aplica safeParse e retorna os items válidos. Se o envelope inteiro falhar,
 * loga warning e devolve []. Callers assim não precisam lidar com exceptions
 * de shape — apenas tratam "sem dados" como caminho válido.
 */
export function parseMetaList<T>(
  schema: z.ZodType<{ data: T[] }>,
  raw: unknown,
  context: string
): T[] {
  const result = schema.safeParse(raw);
  if (!result.success) {
    log.warn(
      { context, issues: result.error.issues.slice(0, 3) },
      "meta response off-schema, ignored"
    );
    return [];
  }
  return result.data.data;
}
