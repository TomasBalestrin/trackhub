# Architecture

**Pattern:** Monolito Next.js (App Router) — domain-based + layer-based híbrido.

## High-Level Structure

```
┌─────────────────────────────────────────────────┐
│  Framer Landing Page (externa)                  │
│  └─ public/tracker.js (embed)                   │
└─────────────────────────────────────────────────┘
           │ eventos PageView/ViewContent/Lead
           ▼
┌─────────────────────────────────────────────────┐
│  Next.js App (Vercel)                           │
│  ├─ /api/tracking           (eventos + CAPI)    │
│  ├─ /api/tracking/enrich    (cache UTM/fbclid)  │
│  ├─ /api/webhook/sheets     (leads do Apps Scr.)│
│  ├─ /api/admin/*            (dashboard data)    │
│  └─ /admin/**               (UI gestão)         │
└─────────────────────────────────────────────────┘
           │                       │
           ▼                       ▼
┌──────────────────┐   ┌──────────────────────────┐
│  Supabase        │   │  Meta Graph API v21.0    │
│  (5 tabelas)     │   │  (CAPI + Marketing)      │
└──────────────────┘   └──────────────────────────┘
```

## Identified Patterns

### Server Components por padrão

**Location:** `src/app/**/page.tsx`, `layout.tsx`
**Purpose:** Renderização server-side sem JS no cliente quando possível
**Implementation:** Client components são marcados explicitamente com `"use client"` (ex: `PremiumDashboard`, `LeadsPage`, componentes `ui/*`)

### Dual Supabase Client

**Location:** `src/lib/supabase/{client,server}.ts`
**Purpose:** Separar acesso browser (anon key) de server (service role bypass RLS)
**Implementation:** `createClient()` para browser, `createServiceClient()` para route handlers administrativas

### API routes como backend

**Location:** `src/app/api/**/route.ts`
**Purpose:** Endpoints REST internos — não há backend separado
**Example:** `src/app/api/webhook/sheets/route.ts` (228 linhas) — ingestão de leads com dedup + qualification

### Qualification score centralizado (parcial)

**Location:** `src/lib/lead/qualification.ts`
**Purpose:** Calcular score de lead baseado em renda/origem/completude
**Issue:** Função `extractHighestIncome` duplicada em `admin/page.tsx` e `admin/leads/page.tsx` — ver CONCERNS.md

## Data Flow

### Fluxo 1 — Captura de lead

```
Framer (landing)
  → tracker.js captura UTM + fbclid + email (on form interaction)
  → POST /api/tracking/enrich   → tracking_cache (Supabase)
  → POST /api/tracking          → tracking_events (Supabase) + Meta CAPI (async)

Form submit
  → Google Apps Script (POST webhook)
  → POST /api/webhook/sheets    → leads (Supabase, merge com tracking_cache)
                                → qualification_score calculado
                                → Meta CAPI Lead event
```

### Fluxo 2 — Admin dashboard

```
/admin (PremiumDashboard, client component)
  → /api/admin/stats            → leads + tracking_events agregados
  → /api/admin/insights         → Meta Marketing API (cache em meta_campaigns_cache)
  → /api/admin/exchange-rate    → open.er-api.com (cache 1h)
  → recharts renderiza KPIs
```

### Fluxo 3 — Gestão de leads

```
/admin/leads
  → /api/admin/leads            → lista paginada com filtros
  → /admin/leads/[id]
  → /api/admin/leads/[id]       → GET detalhes + tracking_events
  → PATCH status (new/contacted/qualified/lost)
```

## Code Organization

**Approach:** Domain-based dentro de `src/lib/` (lead, meta, tracking, supabase); feature-based em `src/app/admin/` (leads, campaigns, ads).

**Estrutura:**

- `src/app/` — rotas (UI + API)
- `src/lib/` — lógica compartilhada por domínio
- `src/components/` — UI reutilizável (ui/ primitives + landing/)
- `src/hooks/` — hooks React (useExchangeRate, useMetaPixel, useUTMParams)
- `src/types/` — interfaces compartilhadas (lead.ts)
- `supabase/migrations/` — schema SQL versionado

**Module boundaries:** Nenhuma separação enforçada (sem monorepo, sem workspace). Boundaries são por convenção de diretório.

## Boundaries Client/Server

- **Server-only:** `src/lib/supabase/server.ts`, `src/lib/meta/capi.ts`, `src/lib/meta/marketing-api.ts`, todas as `route.ts`
- **Client-only:** `src/hooks/*`, `src/components/landing/LeadForm.tsx`, páginas admin marcadas com `"use client"`
- **Compartilhado:** `src/lib/utils.ts`, `src/types/*`, `src/lib/lead/qualification.ts`, `src/lib/lead/validation.ts`
