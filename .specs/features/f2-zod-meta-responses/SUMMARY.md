# F2 — Zod schemas para respostas Meta Marketing API

**Date:** 2026-04-13
**Status:** Done (path `fetchCampaigns`)
**Reference:** CONCERNS C10

## Problem

`src/lib/meta/marketing-api.ts` aceitava qualquer JSON retornado pelo Meta Graph API — uma mudança silenciosa de shape (ex: campo removido, tipo mudado) quebraria em cascata: inserts errados em `meta_campaigns_cache` → dashboard com KPIs zerados/NaN.

## Approach

Validação no boundary: `src/lib/meta/schemas.ts` define schemas Zod para os envelopes `/campaigns`, `/adsets`, `/ads` do Meta v21.0 e um helper `parseMetaList` que aplica `safeParse` e devolve `[]` com `console.warn` quando a resposta está fora do schema.

## Files Changed

- `src/lib/meta/schemas.ts` (novo) — schemas + `parseMetaList` helper
- `src/lib/meta/marketing-api.ts` — consome schemas; extraída constante `META_API`; helper `fetchJson`

## Scope fora desta entrega

- `/api/admin/insights/route.ts` — múltiplos shapes diferentes (overview, campaigns, ads, hourly, demographics, placements, regions, daily) com breakdowns. Merece entrega separada quando for prioridade.
- `/api/admin/campaigns/route.ts` — duplica a chamada de `fetchCampaigns` via dynamic import; já fica protegido por transitividade.

## Verification

- [x] `npx tsc --noEmit` zero erros
- [ ] Executar `/api/cron/sync-campaigns` em dev com Meta API real — verificar que campanhas são populadas normalmente (happy path)
- [ ] Simular resposta malformada (mock) e confirmar que retorna `[]` + warn no log (não quebra)

## Commit

Pendente.
