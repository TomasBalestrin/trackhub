# Bethel TrackHub

**Vision:** Sistema de rastreamento e qualificação de leads ponta-a-ponta para campanhas Meta Ads da Bethel Educação — do clique no anúncio até o status de conversão no CRM interno.
**For:** Time de marketing e gestão da Bethel Educação (operação interna).
**Solves:** Atribuição imprecisa e perda de dados entre anúncio Meta → landing → formulário → CRM; dashboards fragmentados para decisão de orçamento.

## Goals

- **Atribuição confiável:** 1 evento por conversão no Meta (Pixel + CAPI deduplicados), evitando dupla contagem que distorce otimização de campanha.
- **Qualificação automática:** cada lead entra no `/admin` já com score (0–100) baseado em renda/origem/completude para priorização comercial.
- **Dashboard operacional:** gestores vêem KPIs consolidados (leads, CPL, CTR, gasto em BRL) sem abrir Ads Manager.
- **Estabilidade em produção:** zero downtime esperado; novas features sem regredir fluxos já entregues.

## Tech Stack

**Core:**
- Framework: Next.js 16.2.3 (App Router)
- Language: TypeScript 5
- Database: Supabase (Postgres + Auth + RLS)

**Key dependencies:** @supabase/supabase-js, @supabase/ssr, recharts, zod, date-fns, tailwindcss.

> Detalhes completos em `.specs/codebase/STACK.md`.

## Scope

**v1 (já em produção):**
- Captura de leads via tracker.js embeddable em landing Framer
- Webhook Google Apps Script → `/api/webhook/sheets` → `leads` + merge UTMs
- Qualification score automático no ingest
- Dashboard `/admin` com KPIs, tabela de leads, detalhe por lead
- Integração Meta: Pixel + CAPI v21.0 + Marketing API (insights/campaigns/ads/criativos/audiência/alertas)
- Conversão USD→BRL automática com cache

**Expansão em andamento:**
- Novas visões no dashboard admin
- Possíveis integrações adicionais conforme demanda do time de marketing
- Hardening de atribuição Meta (prioridade imediata — ver ROADMAP)

**Explicitly out of scope:**
- Login/signup público de usuários finais (só admin interno)
- CRM completo (status de lead é mínimo: new/contacted/qualified/lost)
- Automação de follow-up (WhatsApp, email) — apenas link para grupo

## Constraints

- **Infra:** deploy exclusivo na Vercel (serverless/Edge). Qualquer cron, rate limit ou job precisa caber nessa plataforma — sem workers persistentes, sem queues auto-hospedadas.
- **Orçamento Meta Ads apertado:** cada event_id duplicado ou chamada redundante à Meta API tem custo real. Precisão de atribuição é prioridade de negócio, não técnica.
- **Stack-lock:** Next 16 (App Router) + Supabase + Vercel definidos; troca requer justificativa forte.
- **Timeline:** expansão contínua, sem deadline rígido anunciado.
