# Quick Task 002: Consolidar `extractHighestIncome`

**Date:** 2026-04-13
**Status:** Done

## Description

Remover duplicações de `extractHighestIncome` em 5 arquivos de `src/app/admin/` e passar a importar de `@/lib/lead/qualification`. Endereça CONCERNS C3 (escopo maior que os 3 arquivos mencionados no concern original).

## Files Changed

- `src/lib/lead/qualification.ts` — `extractHighestIncome` agora é exportado; assinatura ampliada para `string | null | undefined`
- `src/app/admin/page.tsx` — removida duplicata, import adicionado
- `src/app/admin/leads/page.tsx` — removida duplicata interna à função, import ampliado
- `src/app/admin/ads/page.tsx` — removida duplicata, import adicionado
- `src/app/admin/campaigns/page.tsx` — removida duplicata, import adicionado
- `src/app/admin/ads/alertas/page.tsx` — removida duplicata (versão que aceitava `string | null`), import adicionado

## Verification

- [x] `grep ^function extractHighestIncome src/` → sem resultados
- [x] `npx tsc --noEmit` → zero erros

## Commit

_(a commitar em `refactor(lead): consolidate extractHighestIncome`)_
