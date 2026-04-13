# Quick Task 001: Expandir .gitignore

**Date:** 2026-04-13
**Status:** Done

## Description

Substituir o `.gitignore` mínimo (9 bytes, com typo `1.vercel`) por versão completa padrão Next.js + Vercel + env + IDE. Endereça CONCERNS C1.

## Files Changed

- `.gitignore` — reescrito do zero

## Verification

- [x] `git ls-files --error-unmatch .env.local` → "did not match any file(s)" (nunca foi trackeado; sem rotação de chaves necessária)
- [x] `git status --short` após mudança: `.env.local`, `.next/`, `.vercel/`, `node_modules/`, `tsconfig.tsbuildinfo`, `next-env.d.ts` desaparecidos da lista de untracked
- [x] Typo `1.vercel` → `.vercel` corrigido

## Commit

_(a commitar junto com o bootstrap inicial)_
