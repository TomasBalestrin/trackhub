# Q005 — Fix admin insights contract drift + adset/ad qualified attribution

**Date:** 2026-04-13
**Commit:** a37b24a

## Bug

`/api/admin/insights` retorna `{ data: [...], summary: {...} }` com summary usando chaves `total_spend`, `total_impressions`, `total_leads`, `avg_ctr`, etc. Mas:

- `src/app/admin/ads/page.tsx` lia `overviewData.spend`/`actions` direto (esperando o row) — funil zerava.
- `src/app/admin/page.tsx` lia `summary.spend`/`impressions`/`leads` (chaves antigas que não existem) — KPIs zerados.

## Fix

- ads page: desempacota `data[0]` para o overview; `data` para daily/campaigns; converte strings Meta → `Number`.
- dashboard: lê `summary.total_spend`/`total_impressions`/`total_leads`/`avg_ctr`/`avg_cost_per_lead` com fallback.

## Feature adicional

`/admin/campaigns` ganhou drill-down de qualificados (>30k):

- Badge "N qualif. (30k+)" no header de cada adset.
- Tabela de anúncios ganhou colunas Leads + Qualif. 30k+.
- Lista nominal de leads qualificados dentro do adset (nome → renda → ad_name).

Atribuição via `lead.adset_name` / `lead.ad_name`.

## Files

- src/app/admin/ads/page.tsx
- src/app/admin/page.tsx
- src/app/admin/campaigns/page.tsx
