# Testing Infrastructure

## Test Frameworks

**Unit/Integration:** nenhum instalado
**E2E:** nenhum instalado
**Coverage:** n/a

## Test Organization

**Location:** n/a — não há arquivos `*.test.*` ou `*.spec.*` no repositório.
**Naming:** n/a
**Structure:** n/a

## Testing Patterns

### Unit Tests
**Status:** ausentes.

### Integration Tests
**Status:** ausentes.

### E2E Tests
**Status:** ausentes.

## Test Execution

**Commands:** nenhum script de teste em `package.json`.

Scripts disponíveis hoje:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

**Configuration:** n/a

## Coverage Targets

**Current:** 0% (nenhum teste)
**Goals:** não documentados
**Enforcement:** nenhuma

## Test Coverage Matrix

| Code Layer                          | Required Test Type | Location Pattern                 | Run Command |
| ----------------------------------- | ------------------ | -------------------------------- | ----------- |
| `src/lib/lead/qualification.ts`     | unit               | `src/lib/lead/*.test.ts`         | *a definir* |
| `src/lib/lead/validation.ts` (Zod)  | unit               | `src/lib/lead/*.test.ts`         | *a definir* |
| `src/lib/meta/capi.ts` (hashing)    | unit               | `src/lib/meta/*.test.ts`         | *a definir* |
| `src/app/api/**/route.ts`           | integration        | `src/app/api/**/*.test.ts`       | *a definir* |
| Fluxo webhook → lead → CAPI         | integration        | `tests/integration/*.test.ts`    | *a definir* |
| `/admin` UI                         | e2e                | `tests/e2e/*.spec.ts`            | *a definir* |

> Todas as linhas acima estão marcadas como gap — ver `CONCERNS.md` (item: ausência total de testes).

## Parallelism Assessment

| Test Type   | Parallel-Safe? | Isolation Model | Evidence |
| ----------- | -------------- | --------------- | -------- |
| unit        | n/a            | n/a             | sem testes |
| integration | não determinado | exigiria Supabase local ou dedicado por teste | `SUPABASE_SERVICE_ROLE_KEY` aponta para projeto único |
| e2e         | n/a            | n/a             | sem testes |

## Gate Check Commands

| Gate Level | When to Use                             | Command                              |
| ---------- | --------------------------------------- | ------------------------------------ |
| Quick      | Após tasks pequenas                     | `npm run lint`                       |
| Typecheck  | Antes de commit em lógica tipada        | `npx tsc --noEmit`                   |
| Full       | Antes de merge / fim de feature         | `npm run lint && npx tsc --noEmit && npm run build` |
| Build      | Validação final (também gera `.next/`) | `npm run build`                      |

## Recomendações (a decidir via project-init/roadmap)

- Adotar **Vitest** para unit (leve, compatível TS, rápido)
- Adotar **Playwright** para e2e mínimo (`/admin` login fluxo principal, webhook end-to-end)
- Priorizar cobertura em: `qualification.ts` (regras de renda), `capi.ts` (hashing SHA256), webhook (dedup por email)
