# Code Conventions

## Naming Conventions

**Arquivos:**
- camelCase para hooks e libs: `useExchangeRate.ts`, `qualification.ts`, `marketing-api.ts`
- kebab-case para libs multi-palavra: `marketing-api.ts`
- PascalCase para componentes React: `LeadForm.tsx`, mas primitives UI em lowercase (`badge.tsx`, `button.tsx`)
- Next.js convenções obrigatórias: `page.tsx`, `layout.tsx`, `route.ts`

**Funções/Métodos:** camelCase — `extractHighestIncome`, `calculateQualificationScore`, `sendCAPIEvent`, `formatBRL`

**Variáveis:** camelCase — `supabase`, `leads`, `qualificationScore`

**Constantes:** SCREAMING_SNAKE_CASE — `STORAGE_KEY`, `CORS_HEADERS`, `META_API_BASE`, `MAX_RESULTS`

**Componentes:** PascalCase — `PremiumDashboard`, `Badge`, `LeadsPage`

## Code Organization

**Import ordering (observado, não enforçado por lint):**

1. Next.js/React imports
2. Bibliotecas externas
3. Imports absolutos `@/` (alias para `src/`)
4. Imports relativos

Exemplo (`src/app/api/webhook/sheets/route.ts`):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { calculateQualificationScore } from "@/lib/lead/qualification";
```

**File structure (rota):** imports → constantes (CORS_HEADERS, schemas) → OPTIONS handler (se CORS) → handler principal (POST/GET) → helpers locais.

## Type Safety

- **TypeScript strict:** `true` em `tsconfig.json`
- **`interface`** para shapes de dados (`Lead`, `TrackingEvent`, `CAPIEventData`)
- **`type`** para union/alias (`LeadStatus = "new" | "contacted" | "qualified" | "lost"`)
- **Type assertions** pontuais com `as` em respostas de API externa (Meta) — ver CONCERNS
- **Zod** para validação runtime em forms (`src/lib/lead/validation.ts`)

Exemplo (`src/types/lead.ts`):

```typescript
export type LeadStatus = "new" | "contacted" | "qualified" | "lost";

export interface Lead {
  id: string;
  full_name: string;
  email: string;
  // ...
  status: LeadStatus;
  qualification_score: number;
}
```

## Error Handling

**Pattern:** `try/catch` dentro de route handlers retornando `NextResponse.json({ error }, { status })`. Não há Result type nem classe de erro custom.

Exemplo (`src/app/api/webhook/sheets/route.ts`):

```typescript
try {
  // ...
} catch (error) {
  console.error("Webhook error:", error);
  return NextResponse.json({ error: "Processing failed" }, { status: 500 });
}
```

**Problemas observados:**
- Mensagens de erro genéricas ("Processing failed") — dificultam debug em produção
- `console.error` simples, sem logger estruturado
- Campos obrigatórios validados com `if` manual em vez de Zod no webhook

## Comments/Documentation

- **JSDoc:** presente em funções críticas (ex: `/api/webhook/sheets` tem bloco explicativo no topo)
- **Inline:** comentários em português explicando regras de negócio (ex: "Qualificado = acima de 30.000")
- **Block comments:** usados como section markers em scripts grandes (`tracker.js`: "UTM Capture", "Facebook Cookies")
- **Ausentes:** maioria dos componentes UI e hooks sem comentários

## Idiomas

- **Código/nomes:** inglês
- **Comentários de negócio:** português
- **Mensagens de erro retornadas:** inglês
- **UI (labels, botões):** português

## Logging

- `console.log` / `console.error` diretos
- Sem logger estruturado (pino, winston)
- Sem níveis (debug/info/warn/error)
