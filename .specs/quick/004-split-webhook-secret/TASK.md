# Quick Task 004: Segregar `WEBHOOK_SECRET` de `CRON_SECRET`

**Date:** 2026-04-13
**Status:** Done (server-side — passo de operações pendente)

## Description

Separar o secret usado pelo webhook de Google Apps Script do secret usado por crons Vercel. Endereça CONCERNS C6 (reuso de mesmo secret em contextos diferentes).

## Abordagem

Mudança **não-destrutiva**: server aceita `WEBHOOK_SECRET` se definido, senão cai de volta para `CRON_SECRET`. Isso permite rolagem sem downtime.

## Files Changed

- `src/app/api/webhook/sheets/route.ts` — lê `WEBHOOK_SECRET ?? CRON_SECRET`
- `.env.local.example` — adicionado `WEBHOOK_SECRET` com nota de retrocompat

## Verification

- [x] `npx tsc --noEmit` → zero erros
- [x] Se `WEBHOOK_SECRET` não definido, comportamento idêntico ao anterior (aceita `CRON_SECRET`)

## Passos de operação pendentes (fora do escopo do commit)

1. Gerar novo secret aleatório (ex: `openssl rand -hex 32`)
2. Definir `WEBHOOK_SECRET` em Vercel (Production + Preview)
3. Atualizar a constante `WEBHOOK_SECRET` nos 3 arquivos Google Apps Script:
   - `public/script-mentoria-aovivo-2.js`
   - `public/script-mentoria-aovivo-3.js`
   - `public/google-apps-script.js`
   (copiar para o projeto Apps Script correspondente no Google)
4. Testar um submit real — webhook deve aceitar o novo valor
5. Rotacionar `CRON_SECRET` também (está exposto em curl de exemplo no README)
6. Remover fallback `?? CRON_SECRET` em uma próxima iteração quando confirmar que todos os clients usam `WEBHOOK_SECRET`

## Commit

_(a commitar em `chore(auth): support dedicated WEBHOOK_SECRET with CRON_SECRET fallback`)_
