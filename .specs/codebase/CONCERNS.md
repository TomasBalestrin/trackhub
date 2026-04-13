# Concerns

Achados acionáveis no estado atual do repositório. Ordenados por risco/impacto. Cada item tem evidência concreta e caminho de correção.

---

## C1 — `.gitignore` incompleto (crítico / segurança)

**Evidência:** `.gitignore` com 9 bytes, contendo só `.vercel` e `node_modules`.
**Riscos:**
- `.env.local` (com secrets reais do Supabase, Meta CAPI token, Meta App Secret, CRON_SECRET) pode ser commitado
- `.next/` vai pro histórico
- `tsconfig.tsbuildinfo`, `.DS_Store`, logs, build artifacts

**Fix:** substituir por `.gitignore` padrão Next.js:

```
node_modules/
.next/
out/
build/
.vercel
.env*.local
*.tsbuildinfo
next-env.d.ts
.DS_Store
npm-debug.log*
.idea/
.vscode/
```

**Verificar também:** `git log --all --full-history -- .env.local` — se houve commit acidental, rotacionar todas as chaves.

**Prioridade:** máxima (fazer antes do primeiro commit real).

---

## C2 — Ausência total de testes (crítico / qualidade)

**Evidência:** zero arquivos `*.test.*` ou `*.spec.*`; `package.json` sem script `test`.
**Riscos:**
- Regra de qualificação por renda (`extractHighestIncome` + bandas ≥30k / ≥100k / ≥1M) sem cobertura
- Hashing SHA256 do CAPI (`src/lib/meta/capi.ts`) sem validação de formato esperado pelo Meta
- Webhook de sheets faz dedup por email + merge de UTMs sem teste de integração
- Zero garantia contra regressão em rota `/api/tracking` (CORS aberto)

**Fix:** adicionar Vitest para unit/integration + Playwright para e2e mínimo (fluxo webhook → lead → dashboard). Priorizar:
1. `src/lib/lead/qualification.ts`
2. `src/lib/lead/validation.ts`
3. `src/lib/meta/capi.ts`
4. `src/app/api/webhook/sheets/route.ts` (integration, com Supabase real ou mock por camada)

---

## C3 — Duplicação de `extractHighestIncome` (médio / manutenção)

**Evidência:** função idêntica em 3 lugares:
- `src/lib/lead/qualification.ts:7-14`
- `src/app/admin/page.tsx:56-60`
- `src/app/admin/leads/page.tsx:68-75`

**Risco:** mudança de regra (ex: nova banda de renda) exige 3 edições; divergência silenciosa entre cliente e server.
**Fix:** manter só em `src/lib/lead/qualification.ts`, exportar, importar nos dois componentes admin.

---

## C4 — Input validation incompleta no webhook (médio / segurança+dados)

**Evidência:** `src/app/api/webhook/sheets/route.ts` valida apenas `full_name`, `email`, `phone` com `if`. Todos os outros campos (`utm_source`, `fbclid`, `ad_name`, `monthly_income`, `city`, etc.) são gravados sem sanitização.
**Riscos:** payloads malformados populam a DB; possível SQL issues mitigados só pelo client Supabase.
**Fix:** aplicar Zod (já é dependência) — criar `src/lib/lead/webhook-schema.ts` e validar o payload inteiro antes do `for` loop.

---

## C5 — Rate limiting ausente em endpoints públicos (médio / segurança+custo)

**Evidência:** `/api/tracking` e `/api/tracking/enrich` com CORS `*` e sem rate limiting. `/api/admin/insights` faz múltiplas chamadas à Meta API por request sem cache em burst.
**Risco:** abuso → cobrança indevida de Meta API + poluição de `tracking_events`.
**Fix:** adicionar middleware de rate limit (Vercel KV ou Upstash Redis); considerar proteção por token/origin em tracking.

---

## C6 — `CRON_SECRET` único e simples (baixo-médio / segurança)

**Evidência:** mesmo segredo usado em `/api/webhook/sheets` e `/api/cron/sync-campaigns`. String simples; aparece em `curl` de exemplo no README.
**Risco:** vazamento em um contexto compromete ambos os endpoints.
**Fix:** segregar (`WEBHOOK_SECRET` vs `CRON_SECRET`); preferir assinatura HMAC-SHA256 sobre string comparison; remover exemplos com secret real do README.

---

## C7 — Retenção indefinida de tracking (médio / compliance)

**Evidência:**
- `tracking_events`: sem política de limpeza
- `tracking_cache`: migration comenta "limpar após 7 dias" mas **não há trigger/cron implementado**

**Risco:** crescimento indefinido da DB; exposição a pedidos LGPD/GDPR sem janela clara de retenção.
**Fix:** cron Supabase (pg_cron) ou rota `/api/cron/cleanup` com delete por idade.

---

## C8 — Logging não estruturado (baixo-médio / observabilidade)

**Evidência:** `console.error("Webhook error:", error)` — sem níveis, sem correlation id, sem exportação para observabilidade.
**Risco:** impossível debugar incidentes em produção.
**Fix:** adotar logger estruturado (pino) ou integrar Vercel Log Drain com Axiom/Better Stack.

---

## C9 — Dedup Pixel↔CAPI não garantido (médio / atribuição)

**Evidência:** README promete "mesmo `event_id` entre Pixel e CAPI", mas tracker.js gera `eventID` no browser e `/api/tracking` recebe `event_id` do payload — não há enforcement que o mesmo id seja propagado.
**Risco:** dupla contagem de conversões no Meta → otimização de campanha distorcida.
**Fix:** auditar `public/tracker.js` para garantir que o `eventID` é sempre enviado no POST ao `/api/tracking`; adicionar teste de integração.

---

## C10 — Type assertions sem validação em respostas Meta (baixo / robustez)

**Evidência:** `src/app/admin/page.tsx` faz `data: actions as Array<{ action_type: string; value: string }>` sem runtime check.
**Risco:** mudança no shape da Meta API quebra silenciosamente (undefined → NaN em KPIs).
**Fix:** validar com Zod em `src/lib/meta/marketing-api.ts` antes de devolver ao consumidor.

---

## C11 — Magic numbers / hardcodes espalhados (baixo / manutenção)

**Evidência:**
- Meta Pixel ID `1329301652355198` em README, env e `tracker.js`
- Meta API version `v21.0` em 3 arquivos (`capi.ts`, `marketing-api.ts`, `insights/route.ts`)
- Fallback cambial R$ 5,50 hardcoded em `useExchangeRate.ts`
- `MAX_RESULTS = 500`, `DEFAULT_LIMIT = 100` em `insights/route.ts`

**Fix:** `src/lib/meta/config.ts` exportando `META_API_VERSION`, limites, etc.

---

## C12 — Headers de cache e CORS descentralizados (baixo / manutenção)

**Evidência:** `next.config.ts` aplica headers de segurança globais (`X-Frame-Options: DENY`), mas CORS é configurado manualmente rota a rota.
**Fix:** extrair `CORS_HEADERS` para `src/lib/http/cors.ts` e reutilizar.

---

## C13 — `vercel.json` ausente (baixo / infra)

**Evidência:** rota `/api/cron/sync-campaigns` existe mas não há `vercel.json` configurando o cron schedule no repo.
**Risco:** cron só funciona se configurado manualmente no dashboard Vercel — não reproduzível.
**Fix:** adicionar `vercel.json` com `crons` declarativos.

---

## Matriz de priorização

| #   | Impacto | Esforço | Prioridade |
| --- | ------- | ------- | ---------- |
| C1  | alto    | baixo   | **fazer agora** |
| C2  | alto    | alto    | **fazer em fases** — unit primeiro |
| C3  | médio   | baixo   | quick task |
| C4  | alto    | médio   | próxima sprint |
| C5  | alto    | médio   | próxima sprint |
| C6  | médio   | baixo   | quick task |
| C7  | médio   | médio   | agendar |
| C8  | médio   | médio   | agendar |
| C9  | alto    | médio   | próxima sprint |
| C10 | baixo   | baixo   | quick task quando tocar no arquivo |
| C11 | baixo   | baixo   | quick task |
| C12 | baixo   | baixo   | quick task |
| C13 | médio   | baixo   | quick task |
