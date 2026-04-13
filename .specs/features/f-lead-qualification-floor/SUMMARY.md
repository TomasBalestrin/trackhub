# Lead qualification — usar PISO de renda, não TETO

**Date:** 2026-04-13
**Status:** ✅ Deployada em produção + 42 leads backfillados.

## Problem

Admin classificava a faixa **"R$ 15.000 - R$ 30.000"** como **qualificada** porque o código usava `extractHighestIncome(income) >= 30000` — o teto da faixa bate 30k e satisfazia a condição. Regra correta (confirmada pelo usuário): apenas **acima de 30k** conta — a banda 15-30k **não** se enquadra.

Mesmo bug no `calculateQualificationScore`: a banda 15-30k ganhava 35 pts.

## Approach

Mudar a classificação do **TETO** para o **PISO** da faixa declarada. Criado helper único `isQualifiedIncome(income)` = `extractLowestIncome(income) >= 30_000`, usado por:

- `calculateQualificationScore` (bandas 50/45/35/5 agora usam piso)
- Todas as 5 páginas admin que filtram/marcam "qualified" (dashboard, leads, ads, campaigns, ads/alertas)

Constante `QUALIFIED_INCOME_FLOOR = 30_000` centraliza o threshold — mudar lá propaga tudo.

## Files Changed

- `src/lib/lead/qualification.ts`:
  - Nova `extractLowestIncome`
  - Nova `isQualifiedIncome` + constante `QUALIFIED_INCOME_FLOOR`
  - `calculateQualificationScore` reescrita para usar piso
- `src/lib/lead/qualification.test.ts`: +15 testes (extractLowestIncome, isQualifiedIncome com cobertura por banda, regressão 15-30k, formatos VALUE e LABEL)
- 5 páginas admin: `extractHighestIncome(...) >= 30000` → `isQualifiedIncome(...)`

## Verification

- [x] `npm test` → 67/67 passed (antes: 52; +15 novos)
- [x] `npx tsc --noEmit` zero erros
- [x] `npm run build` clean
- [x] Deploy Vercel OK (`bethel-track-ewbc8o86m`)
- [x] Backfill executado: 42 leads tiveram `qualification_score` atualizado (maioria tinha score=0 por motivo histórico — agora todos refletem a regra atual)

## Backfill executado (2026-04-13)

Script one-off em Node lendo `.env.local` via `@supabase/supabase-js`. Resumo dos 42 updates:
- Leads em "Até R$15.000" → 5 pts (vários tinham 0)
- Leads em "15-30k" → 5 pts (antes 35 pts ou 0)
- Leads em "30-100k" → 35 pts
- Leads em "100-500k" / "500k-1M" → 45 pts
- Leads em "Acima de 1M" → 50 pts

Leads com `monthly_income` contendo sufixos tipo "Dono", "Sócio", "Vendedor" (aparentemente bug do Apps Script concatenando `position` com `income`) foram tratados normalmente — piso da faixa continua sendo lido corretamente.

## Observações (não tratadas nesta entrega)

- **1 lead com label corrompido** `"Entre R$100.000 e R$50.000"` (max < min) — provável erro na captura; rule reads floor=50k correctly.
- **Vários leads com `monthly_income` concatenado com `position`** ("Entre R$15.000 e R$30.000 Dono") — indica bug no Google Apps Script. Abrir quick task separada para mapear campos corretamente no webhook.
- **`qualification_score` = 0 histórico** em muitos leads indica que `calculateQualificationScore` não foi aplicado em ingests antigos — suspeita de regressão resolvida; todos os ingests a partir de hoje calculam score normalmente.
