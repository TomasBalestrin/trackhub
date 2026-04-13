# Roadmap

**Updated:** 2026-04-13
**Fase atual:** em produção, expandindo features.

## Próximo marco — Atribuição Meta confiável (2–4 semanas)

Objetivo: garantir que cada conversão seja contada exatamente uma vez no Meta (sem dupla contagem Pixel+CAPI) — impacto direto em custo de Ads.

### Features

- **F1 — Dedup event_id Pixel↔CAPI** *(prioridade 1 — ver CONCERNS C9)*
  - Auditar `public/tracker.js`: garantir que o mesmo `event_id` gerado no browser é enviado tanto ao Pixel quanto ao POST `/api/tracking`.
  - Adicionar validação server-side em `/api/tracking` + log de correlação.
  - Teste de integração ponta-a-ponta (Pixel + CAPI com mesmo id).
- **F2 — Tipagem forte das respostas Meta** *(CONCERNS C10)*
  - Zod schema em `src/lib/meta/marketing-api.ts` para detectar breaking changes da Meta API antes de estourar em KPI.

### Saneamento obrigatório (quick tasks paralelas)

- **Q1 — `.gitignore` completo** *(CONCERNS C1)* — antes do primeiro commit real; se `.env.local` foi commitado em algum momento, rotacionar chaves Supabase/Meta/CRON.
- **Q2 — Consolidar `extractHighestIncome`** *(CONCERNS C3)* — um único arquivo, importar nos dois componentes admin.
- **Q3 — `vercel.json` com crons declarativos** *(CONCERNS C13)* — reproduzível.
- **Q4 — Segregar `WEBHOOK_SECRET` de `CRON_SECRET`** *(CONCERNS C6)*.

## Marco seguinte — Observabilidade + testes críticos (4–8 semanas)

Pré-requisito: F1 concluído e estável.

- **F3 — Vitest + cobertura mínima** *(CONCERNS C2)*
  - `src/lib/lead/qualification.ts` (bandas de renda, edge cases)
  - `src/lib/lead/validation.ts` (schemas Zod)
  - `src/lib/meta/capi.ts` (SHA256 hashing, payload shape)
- **F4 — Logger estruturado** *(CONCERNS C8)* — pino + Vercel Log Drain (Axiom/Better Stack).
- **F5 — Rate limiting em `/api/tracking` e `/api/tracking/enrich`** *(CONCERNS C5)* — Upstash Redis (compatível Vercel); proteção contra abuso e custo Meta.

## Marco futuro — Retenção e compliance (backlog)

- **F6 — Cron de cleanup `tracking_cache`** (TTL 7 dias já documentado) e `tracking_events` (política a definir).
- **F7 — Política LGPD explícita** (texto + mecanismo de solicitação de dados/remoção).

## Backlog de features (não priorizado)

- Novas visões no `/admin` (a coletar do time de marketing)
- Exportação CSV de leads
- Filtros avançados por intervalo + segmento
- Integração WhatsApp (envio automático do link do grupo após status `qualified`)
- Teste de integração Playwright mínimo no fluxo webhook → admin

## Princípios de execução

- **Quick mode** para todas as tasks Q1–Q4 (≤3 arquivos, uma sentença).
- **Spec breve** para F1, F2 (médias).
- **Spec + design + tasks** para F3 (escopo grande, múltiplos arquivos).
- Cada merge: commit atômico, gate `npm run lint && npx tsc --noEmit && npm run build`.
