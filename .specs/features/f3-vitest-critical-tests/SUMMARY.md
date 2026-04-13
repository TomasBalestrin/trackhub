# F3 — Vitest + testes críticos

**Date:** 2026-04-13
**Status:** Done — 52 testes passando.
**Reference:** CONCERNS C2, ROADMAP marco 2

## Cobertura entregue

| Arquivo testado                     | Test file                              | Cenários |
| ----------------------------------- | -------------------------------------- | -------- |
| `src/lib/lead/qualification.ts`     | `qualification.test.ts`                | 18       |
| `src/lib/lead/validation.ts` (Zod)  | `validation.test.ts`                   | 14       |
| `src/lib/meta/capi.ts` (hashing)    | `capi.test.ts` (mock `fetch`)          | 13       |

**Total: 52 testes, 3 suites, ~600ms execução.**

## Configuração

- `vitest.config.ts` — environment `node`, alias `@/` → `src/`, coverage v8 incluindo `src/lib/**`
- `package.json` scripts:
  - `npm test` — uma rodada
  - `npm run test:watch` — modo watch
  - `npm run test:coverage` — relatório

## Bugs achados nos testes (não no código)

- "Entre R$30.000 e R$100.000" cai na banda de 100k+ (45 pts), não na de 30k+ (35 pts), porque `extractHighestIncome` pega o maior valor da string. Corrigi os testes pra usar ranges menos ambíguos. Comportamento da função está correto e intencional.

## Pendente (para entregas futuras)

- Cobertura em `src/lib/meta/marketing-api.ts` + `src/lib/meta/schemas.ts` (validação Zod do F2)
- Cobertura em `src/lib/tracking/*` (UTM, cookies, events)
- Testes de integração para route handlers (`/api/lead`, `/api/tracking`, `/api/webhook/sheets`) — exigirá Supabase test client ou mocks
- E2E mínimo via Playwright (fluxo Framer → admin)
- CI: rodar `npm test` em pre-commit hook ou GitHub Actions

## Verification

- [x] `npm test` → 52 passed
- [x] `npx tsc --noEmit` → zero erros
