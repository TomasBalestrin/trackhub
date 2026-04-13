# F1 — Dedup `event_id` Pixel ↔ CAPI

**Scope:** Medium (clear feature, <10 tasks)
**Priority:** P0 (impacto direto em custo Meta Ads e precisão de atribuição)
**Reference:** CONCERNS C9, ROADMAP marco 1

## Problem

Sistema dispara CAPI por dois caminhos que se sobrepõem no path do `LeadForm` interno (`src/components/landing/LeadForm.tsx` → `/api/lead`), causando:

- **Duplicação de linhas em `tracking_events`** para o mesmo `event_id` (DB não tem UNIQUE constraint)
- **Duas chamadas CAPI** para o mesmo evento (Meta deduplica por `event_id`, mas desperdiça cota de API e polui logs)
- **Fallback frágil** em `/api/lead`: `body.event_id_lead || crypto.randomUUID()` — se caller não passar id, CAPI dispara com id que o Pixel nunca verá, quebrando dedup

O path `tracker.js` + landing Framer já está correto — mesmo `event_id` propagado entre Pixel e `/api/tracking`.

## Evidência

### Duplicação no LeadForm

`src/components/landing/LeadForm.tsx:76-106`:

```ts
const response = await fetch("/api/lead", { body: { ..., event_id_lead: eventIdLead } });
// /api/lead insere tracking_event com event_id_lead E dispara CAPI com event_id_lead

if (data.success) {
  fireEvent("Lead", { eventId: eventIdLead, ... });
  // useMetaPixel.fireEvent → POST /api/tracking com mesmo eventId
  // /api/tracking insere tracking_event com event_id E dispara CAPI com event_id
}
```

Resultado: 1 fluxo = 2 inserts em `tracking_events` + 2 chamadas CAPI (dedup implícito do Meta salva a contagem, mas não a chamada).

### Fallback frágil

`src/app/api/lead/route.ts:103`:

```ts
event_id: body.event_id_lead || crypto.randomUUID(),
```

### Schema

`supabase/migrations/20260409000000_init.sql:116` declara `event_id TEXT NOT NULL` sem UNIQUE.

## Requirements

- **R1** — Uma conversão (Lead, PageView, etc.) deve resultar em no máximo **1 linha** em `tracking_events` para um mesmo `event_id`.
- **R2** — `/api/lead` não deve duplicar a gravação server-side de tracking_event quando o client já vai chamar `fireEvent` depois. **OU** `LeadForm` não deve disparar `fireEvent` server-side após submissão a `/api/lead`.
- **R3** — `/api/lead` não deve inventar `event_id` quando o client não passar. Se faltar `event_id_lead`, pular CAPI e logar warning (não usar `crypto.randomUUID()` como silent fallback).
- **R4** — DB deve rejeitar inserção duplicada de `tracking_events` com mesmo `event_id` (defesa em profundidade).
- **R5** — Pixel client-side continua sendo disparado para toda conversão (atribuição browser-side mantida); apenas a relay server-side é que não deve duplicar.
- **R6** — Mudança não deve quebrar o path do tracker.js/Framer (já correto).

## Approach

**Decisão:** separar responsabilidades de forma inequívoca:

- **Path tracker.js (externo):** client gera `event_id`, dispara Pixel + chama `/api/tracking` (server faz DB + CAPI). _Sem mudança — já correto._
- **Path LeadForm (interno):** client gera `event_id_lead`, dispara Pixel client-side, POSTa `/api/lead` (server faz DB do lead + DB do tracking_event + CAPI). **Client NÃO chama `/api/tracking` depois.**

Ou seja: em `LeadForm`, trocar `fireEvent("Lead", ...)` (que internamente chama `trackPixelEvent` + `sendTrackingEvent`) por apenas `trackPixelEvent(...)` com o mesmo `eventIdLead` já enviado ao `/api/lead`.

Reforços server/DB:

- `/api/lead`: se `body.event_id_lead` ausente, **não disparar CAPI** (retornar `leadId` mas logar warning).
- Migration: `ALTER TABLE tracking_events ADD CONSTRAINT tracking_events_event_id_key UNIQUE (event_id);`
- `/api/tracking` + `/api/lead`: usar `upsert` em vez de `insert` em `tracking_events` com `onConflict: "event_id"` para idempotência — se mesmo evento chegar duas vezes (retry, rede instável), não quebra nem duplica.

## Atomic Steps (inline, não justifica `tasks.md`)

1. **Migration SQL** — `supabase/migrations/2026XXXX_tracking_events_unique_event_id.sql` com `CREATE UNIQUE INDEX` (não ADD CONSTRAINT — permite `CONCURRENTLY` se necessário). Decidir: deletar duplicatas existentes antes (`DELETE ... WHERE id NOT IN (SELECT MIN(id) GROUP BY event_id)`)? Sim, incluir cleanup no mesmo arquivo.

2. **`src/components/landing/LeadForm.tsx`** — trocar `fireEvent("Lead", { eventId, ... })` por chamada direta a `trackPixelEvent("Lead", eventId, customData)` importado de `@/lib/meta/pixel`. Remover import de `useMetaPixel` (ou deixar para outros eventos se usado).

3. **`src/app/api/lead/route.ts`** — remover fallback `|| crypto.randomUUID()` no `sendCAPIEvent`. Se `body.event_id_lead` ausente: `console.warn("lead without event_id_lead, skipping CAPI")` e não disparar CAPI. Converter `tracking_events.insert` em `upsert({ ... }, { onConflict: "event_id", ignoreDuplicates: true })`.

4. **`src/app/api/tracking/route.ts`** — converter `tracking_events.insert` em `upsert` idem.

5. **Verificação:**
   - `npx tsc --noEmit` zero erros
   - Aplicar migration em Supabase (staging primeiro, se houver); em produção rodar o DELETE de dupes antes do UNIQUE
   - Teste manual: submeter LeadForm em dev; checar `tracking_events` tem 1 row para o `event_id` e CAPI log tem 1 chamada
   - Verificar que path tracker.js/Framer continua funcionando (não tocamos nele)

## Out of scope

- Substituir `event_id` por `event_dedup_key` composto — over-engineering pra este stage.
- Adicionar testes automatizados — virão no F3 do ROADMAP.
- Tornar CAPI síncrono e bloquear response do `/api/lead` — assíncrono está OK para lead capture.
- Retry logic em CAPI — fora do escopo.

## Risk / Rollback

- **Risco principal:** UNIQUE constraint falha se já há duplicatas; cleanup inline no SQL mitiga, mas rodar em produção exige cautela (confirmar contagem antes).
- **Rollback:** reverter commits + `DROP INDEX IF EXISTS tracking_events_event_id_key`.
