# Tech Stack

**Analyzed:** 2026-04-13

## Core

- Framework: Next.js 16.2.3 (App Router)
- Language: TypeScript ^5
- Runtime: Node.js (Vercel default)
- Package manager: npm (via package-lock.json)

## Frontend

- UI Framework: React 19.2.4
- Styling: Tailwind CSS 4 (@tailwindcss/postcss)
- Components: Custom UI primitives em `src/components/ui/` (Badge, Button, Card, Input, Select) — não usa shadcn
- Charts: recharts ^3.8.1
- Icons: lucide-react ^1.8.0
- Date: date-fns ^4.1.0
- State Management: nenhum (useState + fetch direto)
- Form Handling: nenhum (sem react-hook-form); validação manual com Zod ^4.3.6

## Backend

- API Style: Next.js App Router route handlers (`src/app/api/**/route.ts`)
- Database: Supabase (Postgres) via `@supabase/supabase-js` ^2.103.0 e `@supabase/ssr` ^0.10.2
- Authentication: Supabase Auth + RLS policies (sem login UI visível; webhooks protegidos por `CRON_SECRET` header)

## Testing

- Unit: **nenhum** (Jest/Vitest não instalados)
- Integration: **nenhum**
- E2E: **nenhum** (Playwright não instalado)

> Ver `CONCERNS.md` — ausência total de testes é risco crítico.

## External Services

- Database & Auth: Supabase (projeto `xvhgxbgbjyabokefsejp`)
- Deploy: Vercel (projeto `bethel-track`, `prj_FJwLcrDbXnDvxUkARoyoeI7r2akm`)
- Ads: Meta Marketing API v21.0, Meta Conversions API (CAPI) v21.0, Meta Pixel
- Exchange: open.er-api.com (USD→BRL)
- Lead ingestion: Google Apps Script → webhook

## Development Tools

- Linter: ESLint ^9 (`eslint-config-next` ^16.2.3, `core-web-vitals` + `typescript`)
- Formatter: nenhum (sem Prettier)
- Build: `next build`
- Scripts: `dev`, `build`, `start`, `lint` (sem `test`)

## Dependências críticas (top 8)

1. `next` 16.2.3
2. `react` 19.2.4
3. `@supabase/supabase-js` 2.103.0
4. `@supabase/ssr` 0.10.2
5. `tailwindcss` 4
6. `zod` 4.3.6
7. `recharts` 3.8.1
8. `date-fns` 4.1.0
