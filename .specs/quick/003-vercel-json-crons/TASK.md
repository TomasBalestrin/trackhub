# Quick Task 003: `vercel.json` com crons declarativos

**Date:** 2026-04-13
**Status:** Done

## Description

Criar `vercel.json` declarando o cron de sync de campanhas Meta, garantindo reprodutibilidade (antes só configurável no dashboard Vercel). Endereça CONCERNS C13.

## Files Changed

- `vercel.json` (novo) — declara cron `/api/cron/sync-campaigns` rodando de hora em hora (`0 * * * *`)

## Decisões

- **Schedule = `0 * * * *` (hourly):** Meta Marketing API tem delay de ~minutos; sync de hora em hora mantém dashboard razoavelmente fresco sem abusar da API (custo/rate). Ajustar se plano Vercel for Hobby (limite 2 crons / daily only) — atual: plano Pro assumido.
- **Autenticação:** a rota já valida `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron injeta esse header automaticamente quando `CRON_SECRET` está em env vars.

## Verification

- [x] Sintaxe JSON válida
- [x] Path bate com rota existente em `src/app/api/cron/sync-campaigns/route.ts`
- [ ] Confirmar no próximo deploy que Vercel reconheceu o cron (painel Settings → Cron Jobs)

## Commit

_(a commitar em `chore: declare meta campaigns sync cron`)_
