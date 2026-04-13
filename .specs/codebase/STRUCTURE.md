# Project Structure

**Root:** `c:\Users\lluys\Desktop\Cursor\track`

## Directory Tree

```
track/
├── .specs/                      # Spec-driven docs (este diretório)
├── .vercel/                     # Vercel project link (bethel-track)
├── public/
│   ├── tracker.js               # Script de tracking embeddable (12.6 KB)
│   ├── script-mentoria-aovivo-2.js
│   ├── script-mentoria-aovivo-3.js
│   └── *.svg
├── src/
│   ├── app/
│   │   ├── admin/               # Dashboard (client + server)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx         # PremiumDashboard
│   │   │   ├── leads/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── campaigns/page.tsx
│   │   │   └── ads/
│   │   │       ├── page.tsx
│   │   │       ├── criativos/page.tsx
│   │   │       ├── audiencia/page.tsx
│   │   │       └── alertas/page.tsx
│   │   ├── api/
│   │   │   ├── webhook/sheets/route.ts
│   │   │   ├── tracking/
│   │   │   │   ├── route.ts
│   │   │   │   └── enrich/route.ts
│   │   │   ├── admin/
│   │   │   │   ├── leads/route.ts
│   │   │   │   ├── leads/[id]/route.ts
│   │   │   │   ├── leads/enrich/route.ts
│   │   │   │   ├── stats/route.ts
│   │   │   │   ├── campaigns/route.ts
│   │   │   │   ├── insights/route.ts
│   │   │   │   ├── exchange-rate/route.ts
│   │   │   │   └── debug/route.ts
│   │   │   ├── cron/sync-campaigns/route.ts
│   │   │   └── lead/route.ts
│   │   ├── obrigado/page.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx             # redirect → /admin
│   │   └── globals.css
│   ├── components/
│   │   ├── landing/LeadForm.tsx
│   │   └── ui/{badge,button,card,input,select}.tsx
│   ├── hooks/
│   │   ├── useExchangeRate.ts
│   │   ├── useMetaPixel.ts
│   │   └── useUTMParams.ts
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── currency.ts
│   │   ├── supabase/{client,server,admin}.ts
│   │   ├── lead/{qualification,validation}.ts
│   │   ├── meta/{capi,marketing-api,pixel}.ts
│   │   └── tracking/{utm,events,cookies}.ts
│   └── types/lead.ts
├── supabase/
│   └── migrations/
│       ├── 20260409000000_init.sql
│       ├── 20260409010000_add_source.sql
│       ├── 20260409020000_add_position.sql
│       ├── 20260409030000_tracking_cache.sql
│       └── 20260409040000_fix_campaigns_unique.sql
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── README.md                    # 316 linhas — referência do projeto
├── AGENTS.md                    # ponteiro para @AGENTS.md
├── CLAUDE.md                    # aviso sobre breaking changes do Next
└── design-system.html           # 83 KB — referência visual standalone
```

## Module Organization

### `src/app/admin/`
**Purpose:** Dashboard interno e gestão de leads/campanhas
**Key files:** `page.tsx` (dashboard KPIs), `leads/page.tsx` (tabela), `ads/*` (subviews de performance)

### `src/app/api/`
**Purpose:** Route handlers (webhooks, tracking, admin data)
**Key files:** `webhook/sheets/route.ts` (ingestão), `tracking/route.ts` (CORS público), `admin/*` (autenticado por service role no server)

### `src/lib/`
**Purpose:** Lógica de domínio reutilizável
**Sub-areas:**
- `supabase/` — clients e helpers de DB
- `lead/` — qualification score + validação Zod
- `meta/` — integrações Pixel/CAPI/Marketing
- `tracking/` — UTM capture, cookies, event shape

### `src/components/`
**Purpose:** UI
- `ui/` — primitives (Badge, Button, Card, Input, Select)
- `landing/` — componentes de captura (LeadForm)

### `src/hooks/`
**Purpose:** Hooks React para features transversais
- `useExchangeRate` — USD→BRL com cache
- `useMetaPixel` — inicializa Pixel no cliente
- `useUTMParams` — captura UTMs da URL

### `supabase/migrations/`
**Purpose:** Schema versionado (5 migrations em 2026-04-09)
**Tabelas:** `profiles`, `leads`, `tracking_events`, `meta_campaigns_cache`, `tracking_cache`

## Where Things Live

**Captura de lead:**
- UI: `src/components/landing/LeadForm.tsx` + tracker externo em `public/tracker.js`
- Business logic: `src/lib/lead/qualification.ts`, `src/lib/lead/validation.ts`
- Data access: `src/app/api/webhook/sheets/route.ts` → Supabase
- Config: `.env.local` (CRON_SECRET, Supabase keys)

**Tracking/Pixel:**
- UI: `src/hooks/useMetaPixel.ts`, `src/hooks/useUTMParams.ts`
- Business logic: `src/lib/tracking/*`, `src/lib/meta/pixel.ts`
- Data access: `src/app/api/tracking/route.ts` + `src/lib/meta/capi.ts`

**Admin dashboard:**
- UI: `src/app/admin/**`
- Business logic: `src/lib/meta/marketing-api.ts`, agregações inline em `src/app/api/admin/stats/route.ts`
- Data access: `src/lib/supabase/server.ts`

## Special Directories

- `public/` — contém script embeddable (`tracker.js`) servido via CDN Vercel ao domínio da landing
- `supabase/migrations/` — ordem cronológica por timestamp no prefixo
- `.specs/` — documentação spec-driven (não versionar backups, apenas current state)
