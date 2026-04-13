# F1 — Summary

**Date:** 2026-04-13
**Status:** Code + migration escritos; deploy pendente.

## Mudanças

- **`supabase/migrations/20260413000000_tracking_events_unique_event_id.sql`** — `CREATE UNIQUE INDEX CONCURRENTLY tracking_events_event_id_key ON tracking_events(event_id)`. Requer inspeção manual prévia se houver duplicatas pré-existentes (falha explícita nesse caso).
- **`src/components/landing/LeadForm.tsx`** — removido `useMetaPixel`; agora chama `trackPixelEvent` direto (só Pixel client-side). CAPI fica com `/api/lead`.
- **`src/app/api/lead/route.ts`** — CAPI só dispara se `body.event_id_lead` presente; sem fallback UUID. `tracking_events.insert` → `upsert` com `onConflict: "event_id", ignoreDuplicates: true`.
- **`src/app/api/tracking/route.ts`** — `tracking_events.insert` → `upsert` idem.

## Invariante pós-mudança

Para qualquer conversão no sistema:
- 1 `event_id` gerado no client
- 1 Pixel fire (client)
- 1 CAPI fire (server — via `/api/lead` OU `/api/tracking`, nunca ambos)
- 1 linha em `tracking_events` (UNIQUE constraint + upsert como defesa em profundidade)

## Passos de deploy (manuais)

1. **Inspecionar duplicatas existentes em produção:**
   ```sql
   SELECT event_id, COUNT(*) FROM tracking_events GROUP BY event_id HAVING COUNT(*) > 1;
   ```
   Se houver resultado, decidir (apagar dupes mais novas? merge?) antes de rodar a migration.

2. **Aplicar migration** — Supabase Studio SQL Editor ou `supabase db push`. Como usa `CONCURRENTLY`, não lock de escrita.

3. **Deploy Vercel** — push pra main (ou branch de staging) ativa o novo código.

4. **Verificação pós-deploy:**
   - Submeter um lead de teste via LeadForm interno
   - Verificar no Supabase: `SELECT * FROM tracking_events WHERE event_id = '<id>' ;` → 1 linha
   - Events Manager do Meta: evento Lead aparece 1x (não 2x)
   - Logs Vercel: 1 chamada `sendCAPIEvent` para Lead, sem warning de event_id ausente

5. **Path tracker.js/Framer** continua funcionando sem mudança — validar que ainda está OK depois do deploy.

## Rollback

- Código: `git revert <hash>`
- DB: `DROP INDEX CONCURRENTLY IF EXISTS tracking_events_event_id_key`
