# Drill-down de Adsets em `/admin/campaigns`

**Scope:** Large (múltiplos componentes: schema, Meta API, sync, UI)
**Reference:** AD-004 (dedup), AD-006 (qualificação)

## Context

Hoje `meta_campaigns_cache` armazena uma linha por **ad** — com `campaign_id/name`, `adset_id/name`, `ad_id/name` achatados. A página `/admin/campaigns` agrupa por `campaign_name` e mostra ads em lista plana.

Falta visibilidade sobre **o nível intermediário** (adsets/conjuntos): quem define orçamento, público, bid strategy e billing. Sem esse nível, o time de marketing não consegue decidir onde cortar/reforçar investimento.

## Requirements

- **R1 — Metadados de adset em cache:** armazenar por adset: `adset_id` (PK), `adset_name`, `campaign_id`, `status`, `daily_budget`, `lifetime_budget`, `bid_strategy`, `optimization_goal`, `billing_event`, `targeting` (JSON com resumo: idade, sexo, geo, interesses), `start_time`, `end_time`, `updated_at`.
- **R2 — Performance por adset:** novas métricas por adset (spend, impressions, clicks, leads, cpl, ctr) — obtidas via Meta Insights API com `level=adset`.
- **R3 — Sync periódico:** `/api/cron/sync-campaigns` passa a popular também adsets. Frequência: mesma de campanhas (hourly).
- **R4 — Drill-down UI:** em `/admin/campaigns`:
  - Expandir uma campanha lista seus adsets (com status, orçamento, leads, CPL, spend)
  - Expandir um adset lista seus ads (como já existe hoje, mas filtrado por adset)
  - Breadcrumbs simples de "Campanha > Adset"
- **R5 — Filtro respeita o DateRangePicker:** métricas de performance do adset consideram o período selecionado (mesmo toggle `created_at` / `lead_at`).
- **R6 — Não quebrar nada:** o que hoje funciona em `/admin/campaigns` (sync, listagem, KPIs) continua funcionando após a mudança.
- **R7 — Observabilidade:** logs estruturados via pino (F4) em sync e consultas.

## Out of scope

- **Edição** de adset (criar/pausar/alterar budget) — só leitura nesta entrega.
- **Targeting detalhado** (lista completa de interesses, lookalikes): guardamos um resumo JSONB, mas não UI de exploração.
- **Histórico temporal** de mudanças de budget — só o estado atual.
- **Testes de integração** com Meta API real — só unit tests em parsers.

## Approach

### Design de dados

**Nova tabela `meta_adsets_cache`** (migration separada):

```sql
CREATE TABLE public.meta_adsets_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adset_id text NOT NULL UNIQUE,
  adset_name text NOT NULL,
  campaign_id text NOT NULL,
  status text,
  daily_budget numeric,            -- em reais (divide por 100 como campaigns)
  lifetime_budget numeric,
  bid_strategy text,
  optimization_goal text,
  billing_event text,
  targeting jsonb,                 -- resumo: { age_min, age_max, genders, geo_locations, interests_count }
  start_time timestamptz,
  end_time timestamptz,
  raw_data jsonb,                  -- payload bruto para inspeção futura
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meta_adsets_cache_campaign ON meta_adsets_cache(campaign_id);
```

**Não mexer em `meta_campaigns_cache`** — a estrutura plana dele (1 linha por ad) continua útil. Vamos cruzar por `adset_id` em queries.

### Meta Graph API

Fields a buscar no endpoint `/{campaign_id}/adsets`:

```
name,status,daily_budget,lifetime_budget,bid_strategy,
optimization_goal,billing_event,targeting,start_time,end_time
```

Para insights: `/insights?level=adset&fields=adset_id,adset_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type&date_preset=...`

### `src/lib/meta/marketing-api.ts`

Adicionar:
- `fetchAdsets(accessToken, campaignId): Promise<MetaAdsetData[]>` — chama Graph
- `summarizeTargeting(raw): TargetingSummary` — extrai age_min, age_max, genders[], geo cities/regions counts, interests.length
- Schema Zod em `src/lib/meta/schemas.ts` — `AdsetItem`, `TargetingSummary`, `AdsetInsightsRow`

### Sync

`/api/cron/sync-campaigns` hoje faz upsert de ads em `meta_campaigns_cache`. Estender:
- Após descobrir cada campanha, antes de descer pros ads, chamar `fetchAdsets(campaign.id)` e upsert em `meta_adsets_cache` (onConflict: `adset_id`).
- Ads continuam sendo upserted em `meta_campaigns_cache` como hoje.

### API `/api/admin/campaigns`

GET atual retorna `{ campaigns, leads }`. Estender para `{ campaigns, adsets, leads }` ou criar endpoint separado `/api/admin/adsets?campaign_id=X`.

**Decisão:** estender o GET existente — payload único evita round-trips adicionais e a listagem de campanhas já depende de ambos.

### Insights por adset

Novo `type=adsets` em `/api/admin/insights/route.ts`:

```ts
adsets: {
  level: "adset",
  fields: "adset_name,adset_id,campaign_id,impressions,clicks,spend,cpc,ctr,reach,actions,cost_per_action_type",
}
```

### UI — `/admin/campaigns/page.tsx`

Mudanças:
- Estado adicional: `adsets: Adset[]`, `adsetInsights: AdsetInsightsRow[]`, `expandedAdset: string | null`
- Ao expandir uma campanha, renderizar seus adsets (group by `adset.campaign_id === campaign.campaign_id`)
- Em cada linha de adset: status badge, budget, leads no período, CPL, botão expandir
- Ao expandir um adset: renderizar os ads atuais (`campaign.ads` filtrado por `adset_id`)

## Atomic Steps

1. **Migration** — `supabase/migrations/2026XXXX_meta_adsets_cache.sql`
2. **Schemas Zod** — `AdsetItem`, `TargetingSummary`, `AdsetInsightsItem` em `src/lib/meta/schemas.ts` + testes unit
3. **marketing-api.ts** — `fetchAdsets`, `summarizeTargeting`; `fetchCampaigns` ganha retorno estruturado ou mantemos side-by-side
4. **Sync route** — `/api/cron/sync-campaigns` upserta adsets (e `/api/admin/campaigns` POST idem)
5. **Admin GET** — `/api/admin/campaigns` retorna `{ campaigns, adsets, leads }`
6. **Insights** — `/api/admin/insights?type=adsets` novo
7. **UI** — drill-down em `/admin/campaigns/page.tsx` com colapsar/expandir
8. **Tests** — unit em schema + summarizeTargeting
9. **Deploy** — migration no Supabase, código no Vercel, rodar sync manual, validar

## Verification

- `npx tsc --noEmit` zero erros
- `npm test` — suítes existentes + novos schemas passando
- `npm run build` OK
- Após deploy: rodar `/api/cron/sync-campaigns` uma vez com `CRON_SECRET` e conferir rows em `meta_adsets_cache`
- Abrir `/admin/campaigns`, expandir uma campanha, ver adsets com métricas e drill-down pros ads

## Risk

- **Rate limit Meta API:** com 1 call extra por campanha (adsets), não deve estourar; monitorar pelo log.
- **Migração com downtime:** `CREATE TABLE` concurrent-safe, sem lock em tabelas existentes.
- **Compatibilidade backward:** cache de ads segue intacto; se algo falhar em adsets, UI cai graciosamente ("sem adsets").
