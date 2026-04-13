# F4 — Logger estruturado com pino

**Date:** 2026-04-13
**Status:** Done — pronto pra deploy.
**Reference:** CONCERNS C8

## Approach

`src/lib/log.ts` exporta `log` (pino) com:
- `level` controlado por `LOG_LEVEL` (default: `info` em prod, `debug` em dev)
- `base: { app: "bethel-track" }` em toda linha
- Sem `transport` — JSON puro a stdout. Vercel parseia automaticamente; localmente fica JSON também (pode pipar `npx pino-pretty` no `next dev` se quiser leitura humana).

Decisão de não usar `transport: pino-pretty` em dev: worker_threads do pino-pretty têm conflitos de bundling com Next.js. JSON em dev é aceitável.

## Files Changed

- `src/lib/log.ts` (novo)
- `src/lib/meta/schemas.ts` — `console.warn` → `log.warn` com objeto estruturado
- 7 route handlers — `console.error/warn/log` → `log.error/warn/info` com `{ err, route, ... }`:
  - `/api/lead`
  - `/api/tracking`
  - `/api/tracking/enrich`
  - `/api/webhook/sheets` (incluindo o log de hit/miss do tracking_cache, agora estruturado)
  - `/api/admin/campaigns`
  - `/api/admin/insights`
  - `/api/cron/sync-campaigns`

Client components (`src/app/admin/ads/*/page.tsx`) **não** foram migrados — pino é server-only e console no client é normal.

## Verification

- [x] `npx tsc --noEmit` zero erros
- [x] `npm test` 52 passed
- [x] `npm run build` produção limpa (todas as routes compiladas)
- [x] `grep "console\." src/app/api src/lib` → vazio
- [ ] Pós-deploy: verificar Vercel Logs mostra JSON estruturado

## Trade-offs e próximos passos

- **Sem correlation id** entre requests do mesmo lead. Adicionar via header `x-request-id` ou gerado é tarefa futura.
- **Sem log drain externo** (Axiom/Better Stack/Datadog). Vercel guarda logs por tempo limitado (Hobby: 1h, Pro: ~7 dias). Opcional para iteração futura.
- Pino bundle adiciona ~30KB a cada serverless function — aceitável.
