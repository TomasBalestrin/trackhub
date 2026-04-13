# External Integrations

## Database

**Service:** Supabase (Postgres + Auth + RLS)
**Purpose:** Storage de leads, eventos de tracking e cache de campanhas Meta
**Implementation:**
- Client-side: `src/lib/supabase/client.ts` (`createClient()` com anon key)
- Server-side: `src/lib/supabase/server.ts` (`createServiceClient()` com service role, bypassa RLS)
**Configuration:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
**Authentication:** Supabase Auth (JWT) + RLS policies em `supabase/migrations/20260409000000_init.sql`

**Tabelas:**
1. `profiles` — role (admin/manager) para autorização via RLS
2. `leads` — dados pessoais + UTMs + Meta ids + score + status
3. `tracking_events` — PageView/ViewContent/Lead/CompleteRegistration
4. `meta_campaigns_cache` — cache de Marketing API (UNIQUE em `(campaign_id, date_start)`)
5. `tracking_cache` — UTMs/fbclid por email (TTL 7 dias, cleanup não automatizado)

**Índices críticos:** 10+ em `leads` (created_at, email, phone, campaign_name, status, fbclid, qualification_score).

## Ads Platform

### Meta Pixel (client-side)
**Purpose:** Tracking browser-side de eventos
**Implementation:** `src/hooks/useMetaPixel.ts` + `public/tracker.js` (embeddable)
**Configuration:** `NEXT_PUBLIC_META_PIXEL_ID` (produção: `1329301652355198`)
**Authentication:** n/a (público)

### Meta Conversions API (server-side)
**Purpose:** Tracking server-side com Enhanced Matching (dedup via `event_id` com Pixel)
**Implementation:** `src/lib/meta/capi.ts` — SHA256 hashing de email/phone/name antes de enviar
**Endpoint:** `https://graph.facebook.com/v21.0/{pixelId}/events`
**Authentication:** `META_CAPI_ACCESS_TOKEN` (Bearer via query)

### Meta Marketing API
**Purpose:** Fetch de insights de campanhas/ads/criativos para dashboard
**Implementation:** `src/lib/meta/marketing-api.ts`, consumido por `src/app/api/admin/insights/route.ts` e `src/app/api/admin/campaigns/route.ts`
**Endpoint:** `https://graph.facebook.com/v21.0/act_{ad_account_id}/*`
**Configuration:** `META_AD_ACCOUNT_ID` (ex: `act_1440237987751692`), `META_APP_SECRET`
**Cache:** tabela `meta_campaigns_cache` (sync via `/api/cron/sync-campaigns` com `CRON_SECRET`)

## Lead Ingestion

### Google Apps Script Webhook
**Purpose:** Receber submissões de formulários em Google Sheets e enviar para o app
**Location:** handler em `src/app/api/webhook/sheets/route.ts`; scripts cliente em `public/script-mentoria-aovivo-*.js`
**Authentication:** header `x-webhook-secret` = `CRON_SECRET`
**Events:** POST com lead único ou array de leads; dedup por email; merge com `tracking_cache` via email

## API Integrations

### Exchange Rate
**Purpose:** Converter USD→BRL para KPIs do dashboard
**Location:** `src/hooks/useExchangeRate.ts` + `src/app/api/admin/exchange-rate/route.ts`
**Endpoint:** `https://open.er-api.com/v6/latest/USD`
**Authentication:** nenhuma (API pública)
**Cache:** 1 hora (in-memory / fallback hardcoded R$ 5,50 — ver CONCERNS)

## Deploy

**Service:** Vercel
**Project:** `bethel-track` (`prj_FJwLcrDbXnDvxUkARoyoeI7r2akm`)
**Production URL:** https://bethel-track.vercel.app
**Config:** `.vercel/project.json`, `next.config.ts` (security headers)

## Webhooks

### `/api/webhook/sheets` (inbound)
**Purpose:** Ingestão de leads de Google Sheets
**Location:** `src/app/api/webhook/sheets/route.ts`
**Events:** POST com `{full_name, email, phone, ...}` ou array

### `/api/cron/sync-campaigns` (inbound, cron)
**Purpose:** Sync periódico de campanhas Meta
**Location:** `src/app/api/cron/sync-campaigns/route.ts`
**Trigger:** Vercel Cron (a validar em `vercel.json` — **não visto no repo**, ver CONCERNS)

## Background Jobs

**Queue system:** nenhum
**Cron:** Vercel Cron (via route handler `/api/cron/sync-campaigns`)
**Cleanup jobs:** nenhum automatizado (tracking_cache TTL 7 dias é comentado na migration mas sem trigger)

## Environment Variables (nomes)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_META_PIXEL_ID
META_CAPI_ACCESS_TOKEN
META_AD_ACCOUNT_ID
META_APP_SECRET
NEXT_PUBLIC_BASE_URL
WHATSAPP_GROUP_URL
CRON_SECRET
```
