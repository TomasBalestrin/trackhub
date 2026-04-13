# Bethel TrackHub

Sistema completo de rastreamento de leads para campanhas Meta Ads da Bethel Educacao.

**URL Producao:** https://bethel-track.vercel.app  
**Admin:** https://bethel-track.vercel.app/admin

---

## Arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16.2.3, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (App Router) |
| Banco de dados | Supabase (projeto: trackhub, ref: xvhgxbgbjyabokefsejp) |
| Tracking | Meta Pixel (client) + Conversions API (server) |
| Deploy | Vercel (bethel-track) |
| Formularios | Externos (Framer) → Google Sheets → Webhook |
| Cambio | API open.er-api.com (USD→BRL, cache 1h) |

---

## Fluxo de Dados

```
Lead clica anuncio Meta (com UTMs)
    ↓
PagTrust (divisor de trafego 50/50)
    ↓
Landing Page Framer (mentoria-aovivo-2 ou mentoria-aovivo-3)
    ↓
tracker.js captura UTMs + inicia Meta Pixel
    ↓ PageView + ViewContent (automaticos)
    ↓
Lead preenche formulario
    ↓
tracker.js intercepta form → envia email + UTMs para /api/tracking/enrich (cache)
    ↓ Lead event (Pixel + CAPI)
    ↓
Formulario vai para Google Sheets
    ↓
Google Apps Script (onChange) detecta nova linha → POST /api/webhook/sheets
    ↓
Webhook busca tracking_cache pelo email → mescla UTMs/Meta Ads → cria lead com dados completos
    ↓
Lead aparece no admin com: dados pessoais + UTMs + Meta Ads + eventos + score
```

---

## Tabelas do Banco (Supabase)

### `leads`
Dados completos do lead: pessoais, UTMs, Meta Ads, score, status, timestamps de conversao.

### `tracking_events`
Eventos de tracking: PageView, ViewContent, ButtonClick, Lead, CompleteRegistration. Vinculados ao lead por lead_id e fbc/fbp.

### `tracking_cache`
Cache temporario dos dados de tracking (UTMs, fbc, fbp) enviados pelo tracker.js. Consultado e deletado quando o webhook cria o lead.

### `meta_campaigns_cache`
Cache das campanhas/anuncios sincronizados da Marketing API. Chave unica: ad_id. Atualizado via sync manual ou cron.

### `profiles`
Perfis de usuario com roles (admin/manager) para RLS.

---

## API Routes

| Rota | Metodo | Descricao |
|---|---|---|
| `/api/webhook/sheets` | POST | Recebe leads do Google Apps Script. Busca tracking_cache, mescla UTMs, calcula score, vincula eventos |
| `/api/tracking` | POST | Recebe eventos do tracker.js (PageView, ViewContent, Lead, ButtonClick). CORS habilitado. Envia para CAPI |
| `/api/tracking/enrich` | POST | Recebe email + UTMs do tracker.js no submit do form. Armazena na tracking_cache |
| `/api/admin/leads` | GET | Lista leads (service role, bypassa RLS). Filtros: source, status |
| `/api/admin/leads/[id]` | GET/PATCH | Detalhe do lead + eventos. PATCH atualiza status |
| `/api/admin/stats` | GET | Todos os leads para dashboard |
| `/api/admin/campaigns` | GET/POST | GET: lista campanhas + leads. POST: sync do Meta |
| `/api/admin/insights` | GET | Dados da Marketing API (overview, campaigns, ads, hourly, demographics, placements, regions, daily) |
| `/api/admin/exchange-rate` | GET | Taxa de cambio USD→BRL (cache 1h) |
| `/api/admin/debug` | GET/DELETE | Debug: tracking_cache + events. DELETE: remove leads por ID |
| `/api/cron/sync-campaigns` | GET | Sync de campanhas do Meta. Auth: Bearer CRON_SECRET |
| `/api/lead` | POST | Criacao direta de lead (formulario interno, nao usado no fluxo atual) |

---

## Paginas do Admin

| Pagina | URL | Funcao |
|---|---|---|
| **Dashboard** | `/admin` | KPIs, funil de conversao, grafico diario, heatmap horario, posicionamentos, leads recentes, alertas |
| **Leads** | `/admin/leads` | Tabela com filtros (busca, status, origem, renda). Botao "Qualificados 30k+". Renda 30k+ em verde |
| **Lead Detalhe** | `/admin/leads/[id]` | Dados pessoais, gestao de status, atribuicao Meta Ads, UTMs, timeline de eventos, timestamps de conversao |
| **Campanhas** | `/admin/campaigns` | KPIs, sync manual, filtros, expandir campanha → anuncios + leads + stats (score medio, cargo, renda, taxa qualificacao) |
| **Performance Ads** | `/admin/ads` | KPIs (gasto, leads, CPL, CTR), grafico diario, comparativo campanhas, funil visual |
| **Criativos** | `/admin/ads/criativos` | Winner vs Loser, ranking por CPL, video vs estatico |
| **Audiencia** | `/admin/ads/audiencia` | Demographics (idade/genero), heatmap horario, posicionamentos (Feed/Reels/Stories), top estados |
| **Alertas** | `/admin/ads/alertas` | CPL spike, campanhas sem leads, budget burn, CTR drop, best performer, lead quality, peak hour, resumo semanal |

---

## tracker.js (Script Embeddable)

Instalado nos sites Framer via Custom Code → Header:

```html
<script src="https://bethel-track.vercel.app/tracker.js" data-pixel="1329301652355198" data-api="https://bethel-track.vercel.app" data-source="mentoria-aovivo-3"></script>
```

### Eventos automaticos:
- **PageView** — ao carregar a pagina
- **ViewContent** — scroll 50% ou 10s
- **ButtonClick** — clique em qualquer botao (com texto do botao)
- **Lead** — ao submeter formulario (intercepta automaticamente)

### Funcionalidades:
- Captura UTMs da URL (utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid)
- Persiste em sessionStorage + localStorage
- Inicia Meta Pixel automaticamente
- Intercepta forms e envia email + UTMs para /api/tracking/enrich
- Detecta forms dinamicos do Framer via MutationObserver
- Usa sendBeacon para entrega confiavel
- Expoe API publica: `window.BethelTrack`

---

## Google Apps Scripts

Dois scripts, um para cada planilha:
- `script-mentoria-aovivo-2.js` — SOURCE: "mentoria-aovivo-2"
- `script-mentoria-aovivo-3.js` — SOURCE: "mentoria-aovivo-3"

### Gatilho: `onChange` (nao onFormSubmit)
O `onFormSubmit` so funciona com Google Forms. Como os dados vem do Framer (integracao externa), usamos `onChange` que detecta novas linhas.

### Funcoes:
- `criarGatilho()` — executar UMA VEZ. Cria gatilho onChange + marca linhas atuais como processadas
- `onSheetChange(e)` — automatico. Detecta novas linhas, envia para webhook
- `enviarTodosLeads()` — manual. Envia todos os leads da planilha (importacao em lote)

### Mapeamento de colunas:

**aula-ao-vivo-2:** Date, Email, porition→position, faturamento→monthly_income, Name→full_name, phone  
**aula-ao-vivo-3:** Date, Email, Location→monthly_income, Name→full_name, phone, faturamento→monthly_income, position

---

## Qualificacao de Leads

### Score (0-100):
- **Renda** (0-50 pts): Extrai o maior valor numerico da string. >= 1M = 50, >= 100k = 45, >= 30k = 35, < 30k = 5
- **Fonte** (0-30 pts): instagram/facebook = 30, google = 25, youtube = 20, indicacao = 15
- **Completude** (0-20 pts): cidade = 10, estado = 10

### Labels:
- >= 80: Quente
- >= 50: Morno
- < 50: Frio

### Regra de qualificacao:
Leads com renda >= R$ 30.000 sao considerados qualificados. O sistema sempre considera o **maior valor** da faixa de renda (ex: "Entre R$10.000 e R$30.000" → considera R$ 30.000).

---

## Meta Ads Integration

### Pixel (client-side):
- ID: 1329301652355198
- Injetado pelo tracker.js nos sites Framer
- Eventos: PageView, ViewContent, Lead, CompleteRegistration

### Conversions API (server-side):
- Token: System User Token (mesmo para CAPI e Marketing API)
- API v21.0
- Enhanced Matching: email, phone, name, city, state hashados (SHA256)
- Deduplicacao: mesmo event_id entre Pixel e CAPI

### Marketing API:
- Conta: ASCENSAO BETHEL (act_1440237987751692)
- Moeda da conta: **USD** (convertido para BRL no frontend)
- Dados disponiveis: campanhas, conjuntos, anuncios, insights, demographics, posicionamentos, horarios, regioes
- Permissao: ads_read

### UTMs nos anuncios:
Configurados no campo "Parametros de URL" do Meta Ads Manager:
```
utm_medium=ads_fb&utm_source={{site_source_name}}_{{placement}}&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}
```
O `fbclid` e adicionado automaticamente pelo Meta.

### Redirect PagTrust:
Os anuncios apontam para `https://l.pagtrust.com.br/fnc3612dfb` que redireciona para o Framer **mantendo todos os UTMs**.

---

## Conversao de Moeda

A conta de anuncios esta em USD. O sistema converte para BRL:
- API: `open.er-api.com/v6/latest/USD` (gratuita)
- Cache: 1 hora (server-side + client-side)
- Fallback: R$ 5,50 se a API falhar
- Hook: `useExchangeRate()` — retorna `{ rate, toBRL, formatBRL }`
- Endpoint: `/api/admin/exchange-rate`

---

## Variaveis de Ambiente

| Variavel | Descricao |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (trackhub) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anonima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (bypassa RLS) |
| `SUPABASE_ACCESS_TOKEN` | Token CLI do Supabase |
| `NEXT_PUBLIC_META_PIXEL_ID` | ID do Meta Pixel (1329301652355198) |
| `META_SYSTEM_USER_TOKEN` | Token do System User (Marketing API) |
| `META_CAPI_ACCESS_TOKEN` | Token para Conversions API (mesmo do System User) |
| `META_AD_ACCOUNT_ID` | ID da conta de anuncios (act_1440237987751692) |
| `META_APP_SECRET` | App Secret do Meta App |
| `NEXT_PUBLIC_BASE_URL` | URL base da aplicacao |
| `WHATSAPP_GROUP_URL` | URL do grupo WhatsApp |
| `CRON_SECRET` | Secret para autenticacao do cron e webhook |

---

## Design System

- **Cores:** Navy #001321/#002C4A, Gold #B19365, Success #2E7D32, Warning #F57C00, Error #C62828, Info #1565C0
- **Fontes:** Plus Jakarta Sans (texto), JetBrains Mono (codigo)
- **Radius:** sm 6px, md 10px, lg 14px, xl 20px
- **Sombras:** sm, md, lg, xl com opacidade navy

---

## Comandos Uteis

```bash
# Desenvolvimento
npm run dev

# Build
npx next build

# Deploy
npx vercel --prod

# Supabase migrations
npx supabase db push

# Sync campanhas do Meta
curl -H "Authorization: Bearer bethel-track-cron-secret-2026" "https://bethel-track.vercel.app/api/cron/sync-campaigns"

# Enviar leads de teste
curl -X POST "https://bethel-track.vercel.app/api/webhook/sheets" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: bethel-track-cron-secret-2026" \
  -d '{"full_name":"Nome","email":"email@test.com","phone":"11999999999","monthly_income":"Entre R$30.000 e R$100.000","position":"Dono","source":"mentoria-aovivo-3"}'
```

---

## Estrutura de Arquivos

```
src/
  app/
    layout.tsx                          # Layout raiz (fonts, CSS)
    page.tsx                            # Redirect para /admin
    globals.css                         # Tailwind + design tokens
    admin/
      layout.tsx                        # Sidebar nav + main content
      page.tsx                          # Dashboard premium
      leads/page.tsx                    # Tabela de leads
      leads/[id]/page.tsx               # Detalhe do lead
      campaigns/page.tsx                # Gestao de campanhas
      ads/page.tsx                      # Performance de Ads
      ads/criativos/page.tsx            # Ranking de criativos
      ads/audiencia/page.tsx            # Analise de audiencia
      ads/alertas/page.tsx              # Alertas e insights
    api/
      webhook/sheets/route.ts           # Webhook Google Sheets
      tracking/route.ts                 # Eventos do tracker.js
      tracking/enrich/route.ts          # Cache de enriquecimento
      admin/leads/route.ts              # CRUD leads
      admin/leads/[id]/route.ts         # Detalhe lead
      admin/stats/route.ts              # Stats para dashboard
      admin/campaigns/route.ts          # Campanhas + sync
      admin/insights/route.ts           # Marketing API insights
      admin/exchange-rate/route.ts      # Cambio USD→BRL
      admin/debug/route.ts              # Debug + delete
      cron/sync-campaigns/route.ts      # Sync cron
      lead/route.ts                     # Criacao direta
  components/ui/
    badge.tsx, button.tsx, card.tsx, input.tsx, select.tsx
  hooks/
    useExchangeRate.ts                  # Hook de cambio USD→BRL
  lib/
    utils.ts                            # cn, formatPhone, formatDate
    currency.ts                         # getUSDtoBRL, formatBRL (server)
    supabase/client.ts, server.ts       # Clientes Supabase
    meta/capi.ts                        # Conversions API sender
    meta/pixel.ts                       # Pixel helpers (client)
    meta/marketing-api.ts              # Marketing API client
    tracking/utm.ts, events.ts, cookies.ts
    lead/qualification.ts, validation.ts
  types/lead.ts                         # Interfaces e constantes
public/
  tracker.js                            # Script embeddable
  script-mentoria-aovivo-2.js           # Apps Script planilha 2
  script-mentoria-aovivo-3.js           # Apps Script planilha 3
supabase/
  migrations/                           # SQL migrations
```
