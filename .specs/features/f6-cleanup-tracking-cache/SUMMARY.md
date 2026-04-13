# F6 — Cron de cleanup para `tracking_cache`

**Date:** 2026-04-13
**Status:** Done — pronto pra deploy.
**Reference:** CONCERNS C7, ROADMAP marco 3

## Scope

Apenas `tracking_cache` (TTL 7 dias já documentado na migration original).
`tracking_events` fica fora — política de retenção precisa ser definida com
o negócio (LGPD, janela de análise histórica).

## Files Changed

- `src/app/api/cron/cleanup-tracking-cache/route.ts` (novo) — GET handler
  protegido por `Authorization: Bearer ${CRON_SECRET}` que faz DELETE em
  rows com `created_at < now() - 7 days`, retorna contagem deletada e
  loga via pino.
- `vercel.json` — adicionada entrada em `crons` para rodar
  `0 3 * * *` (03:00 UTC diariamente, horário de baixa carga).

## Decisões

- **Vercel Cron + rota HTTP** em vez de `pg_cron`: consistência com
  `/api/cron/sync-campaigns` existente, logs estruturados no Vercel (F4),
  debug mais fácil via invocação manual.
- **TTL hardcoded em 7 dias** (`TTL_DAYS = 7`): alinhado com o comentário
  na migration original. Se mudar, trocar em 1 lugar.
- **Delete sem cursor/batch**: com 44 rows atuais e crescimento baixo
  (enriquecimento é consumido + deletado pelo webhook no happy path),
  deletes diários ficarão sempre na casa de dezenas/poucas centenas. Se
  crescer, adicionar `.limit(1000)` + loop.

## Verification

- [x] `npx tsc --noEmit` zero erros
- [x] `npm test` 52 passed
- [x] `npm run build` produziu a rota
- [ ] Pós-deploy: verificar no painel Vercel → Settings → Cron Jobs que
  ambos os crons aparecem (`sync-campaigns` hourly, `cleanup-tracking-cache`
  daily 03:00 UTC)
- [ ] Próxima execução: conferir log `"tracking_cache cleanup ok"` e
  contagem de rows deletadas (0 nos primeiros dias, até backlog surgir)

## Commit

Pendente.
