# Drill-down de Adsets — Summary

**Date:** 2026-04-13
**Status:** Code + migration deployadas em prod. Popular dados depende de rate limit da Meta baixar.

## Entregue

- `supabase/migrations/20260413020000_meta_adsets_cache.sql` — nova tabela aplicada no Supabase
- `src/lib/meta/schemas.ts` — `AdsetDetailListResponse`, `AdsetInsightListResponse`
- `src/lib/meta/marketing-api.ts`:
  - `fetchCampaigns` refatorada: retorna `{ ads, adsets }` em uma única passada (1 call `/campaigns` + 1 `/adsets` por campanha + 1 `/ads` por adset — sem duplicação)
  - `fetchAdsets` independente (mantido para callers ad-hoc)
  - `summarizeTargeting` extrai idade/gênero/geo/counts de um `targeting` Meta
- `/api/cron/sync-campaigns` e `/api/admin/campaigns` POST: upsert em ambas as caches (`meta_campaigns_cache` + `meta_adsets_cache`)
- `/api/admin/campaigns` GET: retorna `{ campaigns, adsets, leads }`
- `/api/admin/insights` aceita `type=adsets` (level=adset)
- `/admin/campaigns`: nova seção "Conjuntos de anúncios" dentro de cada campanha expandida. Cada adset mostra status, budget, leads/spend/CPL/CTR no período, e expande para targeting + ads filtrados.
- 6 testes novos para `summarizeTargeting` (total: 95 passed)

## Bloqueio atual — Meta rate limit

Meta retornou `error code 17, subcode 2446079` ("A conta de anúncios tem uma quantidade excessiva de chamadas") quando o primeiro sync rodou em prod. Isso é **rate limit a nível de conta de anúncios**, dinâmico e dependente do histórico recente de chamadas.

Não é bug de código. O próximo tick do Vercel Cron (`0 * * * *` — de hora em hora) vai tentar de novo e eventualmente passar quando o Meta liberar. Depois disso:
- `meta_adsets_cache` terá dados
- UI exibe os conjuntos com metadados completos
- insights por adset funcionam

## Verificação pós-rate-limit

Após ver o rate limit cair (testar com `curl` direto ao Graph API), o próximo sync deve retornar:
```json
{"success":true, "ads_total": >0, "ads_upserted": >0, "adsets_total": >0, "adsets_upserted": >0}
```

E `/admin/campaigns` → expandir campanha → listar adsets com métricas no período escolhido.

## Ajuste recomendado (futuro)

- **Reduzir frequência do cron** de hourly para 6-12h, já que campanhas mudam pouco.
- **Rate limit handler** no `fetchCampaigns`: detectar `error.code=17` e fazer exponential backoff, ou marcar como "sync em pausa" e retomar no próximo tick.
- **Métricas por adset como cache** (não só on-demand) — evita re-chamada a cada visita de `/admin/campaigns`.
