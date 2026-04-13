# State

**Last Updated:** 2026-04-13
**Current Work:** Q005 deployada (a37b24a) — fix de contrato `/api/admin/insights` em ads/dashboard + drill-down de qualificados (>30k) por adset/ad em `/admin/campaigns`. Adset metadata ainda depende de cron passar pelo rate limit Meta (B-001).

---

## Recent Decisions (Last 60 days)

### AD-001: Adotar `tlc-spec-driven` como framework de planejamento (2026-04-13)

**Decision:** Usar a skill `tlc-spec-driven` (v2.0.0) instalada globalmente em `~/.claude/skills/` para todo planejamento e implementação no repo `track`.
**Reason:** Auto-sizing evita cerimônia em fixes pequenos; rastreabilidade em `.specs/` dá memória persistente entre sessões; separação clara de quick-mode vs pipeline completo.
**Trade-off:** Disciplina contínua necessária — se `STATE.md` e `.specs/` não forem atualizados, viram pasta morta e pioram a situação.
**Impact:** Todo trabalho passa a ser registrado em `.specs/`; commits atômicos com conventional commits; feature branches por spec.

### AD-002: `track` como projeto piloto (2026-04-13)

**Decision:** Adotar tlc-spec-driven no `track` antes de estender para Disparotey/Bethel Metrics.
**Reason:** Brownfield real, stack definida, produção ativa — exercita todas as fases do framework.
**Trade-off:** Adiar benefícios em outros projetos até validar aqui.
**Impact:** Aprendizado do piloto vira base para adotar nos demais.

### AD-006: Qualificação por PISO de renda, não TETO (2026-04-13)

**Decision:** `isQualifiedIncome(income)` usa `extractLowestIncome(...) >= 30_000` como regra única. Score também recomputado pelo piso.
**Reason:** Stakeholder (usuário) confirmou: "apenas acima de 30k; 15-30k não se enquadra". O antigo `extractHighestIncome(...) >= 30_000` falsamente qualificava a banda 15-30k porque o teto batia 30k.
**Trade-off:** Semântica passa a ser conservadora (lead declara X-Y, assumimos que ganha pelo menos X). Faz-se a escolha mais alinhada ao filtro de stakeholder: melhor subestimar do que superestimar qualificação.
**Impact:** 42 leads tiveram score corrigido via backfill. Dashboard + contagens de qualificados em todas as 5 páginas admin agora exibem números verdadeiros. Constante `QUALIFIED_INCOME_FLOOR` em `src/lib/lead/qualification.ts` é o único lugar a mudar se o threshold for ajustado.

### L-003: Dados antigos de `qualification_score` inconsistentes (2026-04-13)

**Context:** Backfill descobriu 42/81 leads com score divergente do calculado pela regra.
**Problem:** Vários leads com score=0 mesmo tendo income/how_found/city/state preenchidos. Sugere regressão passada onde `calculateQualificationScore` não foi aplicado no ingest, ou migration inseriu defaults.
**Solution:** Backfill one-off corrigiu tudo. A regra ativa hoje em `/api/webhook/sheets` + `/api/lead` aplica score corretamente em todo ingest novo.
**Prevents:** Futuro drift — qualquer ajuste em bands/thresholds deve vir acompanhado de backfill.

### L-004: Google Apps Script está poluindo `monthly_income` com sufixo de `position` (2026-04-13)

**Context:** Backfill expôs valores como "Entre R$15.000 e R$30.000 Dono" em `monthly_income`.
**Problem:** Indica que o Apps Script de webhook concatena campos de planilha que deveriam ir em `position` no campo errado.
**Solution pendente:** Inspecionar `public/google-apps-script.js` + scripts gêmeos e o mapeamento de colunas da planilha. Abrir quick task separada.

### AD-005: Vercel Cron em vez de pg_cron para cleanup (2026-04-13)

**Decision:** Cleanup de `tracking_cache` via rota `/api/cron/cleanup-tracking-cache` + entry em `vercel.json` crons, não via `pg_cron` do Supabase.
**Reason:** Consistência com `/api/cron/sync-campaigns` existente; logs estruturados via pino (F4) visíveis em Vercel Logs; debug manual simples via GET autenticado.
**Trade-off:** Uma invocação HTTP adicional por dia (desprezível); dependência de Vercel estar up para manutenção do DB (aceitável).
**Impact:** Rotas de cron agora são o padrão pra cleanups. Políticas de retenção de `tracking_events` (quando definidas) vão pelo mesmo caminho.

### AD-004: Separação client-only Pixel / server-only CAPI (2026-04-13)

**Decision:** No LeadForm interno, client dispara APENAS Pixel; `/api/lead` dispara APENAS CAPI; ambos compartilham o mesmo `event_id_lead` gerado no client. `/api/tracking` continua fazendo Pixel relay para o path externo (tracker.js + Framer, sem mudança).
**Reason:** Simplifica o contrato (cada lado tem uma responsabilidade), elimina a dupla gravação em `tracking_events`, remove fallback `crypto.randomUUID()` em `/api/lead` que gerava event_id órfão.
**Trade-off:** Se `/api/lead` falhar parcialmente (CAPI down) o Pixel-side já disparou e não há retry automático. Aceito no trade — falhas no CAPI são raras e o Meta cruza Pixel+CAPI por best-effort.
**Impact:** `src/components/landing/LeadForm.tsx` e `src/app/api/lead/route.ts` mudaram; migration `20260413000000_tracking_events_unique_event_id.sql` adiciona UNIQUE INDEX.

### AD-003: Prioridade imediata é dedup Pixel/CAPI (2026-04-13)

**Decision:** Próximas 2–4 semanas focadas em F1 (dedup `event_id` entre Pixel e CAPI), não em testes nem features novas.
**Reason:** Confirmado pelo usuário; impacto em custo Meta Ads é direto; precisão de atribuição é pré-requisito para qualquer análise confiável de dashboard.
**Trade-off:** Testes automatizados (C2) e rate limiting (C5) ficam para o marco seguinte.
**Impact:** Qualquer PR fora desse escopo entra em Deferred Ideas.

---

## Active Blockers

### B-001: Meta Ad Account rate limit (2026-04-13)

**Discovered:** 2026-04-13 durante primeiro sync de adsets em prod
**Impact:** `meta_adsets_cache` vazio; UI drill-down em `/admin/campaigns` mostra "Nenhum adset em cache" até o bloqueio cair
**Workaround:** aguardar próximo Vercel Cron tick; é 1 por hora e Meta costuma liberar em 30min a algumas horas
**Resolution:** Acompanhar próximos syncs. Se persistir, reduzir frequência do cron para 6-12h. Considerar exponential backoff com detecção de `error.code=17` em `fetchCampaigns`.

---

## Lessons Learned

### L-001: `CREATE INDEX CONCURRENTLY` incompatível com Supabase migrations (2026-04-13)

**Context:** F1 deploy
**Problem:** Migration usando `CREATE INDEX CONCURRENTLY` falha porque Supabase aplica migrations dentro de transação e Postgres não permite CONCURRENTLY em tx block.
**Solution:** Para tabelas pequenas (~milhares), usar `CREATE INDEX` regular — lock de escrita é desprezível. Para tabelas grandes, aplicar índice fora do migration system (psql direto ou Supabase Studio SQL).
**Prevents:** Deploy quebrado por incompatibilidade silenciosa entre PostgreSQL e Supabase migration runner.

### L-005: Contrato `/api/admin/insights` mudou para `{ data, summary }` e quebrou pages silenciosamente (2026-04-13)

**Context:** Funil de Conversão em `/admin/ads` mostrava 0 em tudo; KPIs do dashboard zerados.
**Problem:** A rota foi refatorada para retornar `{ data: [...], summary: { total_spend, total_impressions, total_leads, avg_ctr, avg_cost_per_lead, ... } }`, mas `src/app/admin/ads/page.tsx` ainda lia `overviewData.spend/actions` direto, e `src/app/admin/page.tsx` lia `summary.spend/leads` (chaves antigas inexistentes). Sem TypeScript end-to-end (a route retorna `NextResponse.json` sem tipo compartilhado), nada quebrou no build.
**Solution:** Q005 — desempacotar `data[0]` para overview, `data` para daily/campaigns; usar chaves `total_*`/`avg_*` no dashboard com fallback.
**Prevents:** Definir um tipo compartilhado (`InsightsResponse`) em `src/types/` e importá-lo tanto na route quanto nas pages elimina esse drift na próxima refatoração. TODO futuro.

### L-002: Vercel valida secrets em env vars quando há crons em vercel.json (2026-04-13)

**Context:** F1 deploy quebrou logo após adicionar `vercel.json` com cron declarativo
**Problem:** `CRON_SECRET` no Vercel tinha `\n` literal (interpretado como newline) no valor armazenado. Sem cron declarado, Vercel não validava; ao declarar, validação rejeitou: "leading or trailing whitespace not allowed in HTTP header values".
**Solution:** `vercel env rm` + `printf "value" | vercel env add` (sem newline trailing).
**Prevents:** Deploys quebrados ao adicionar features de infra que ativam validações latentes em env vars antigos.

---

## Quick Tasks Completed

| #   | Description                                            | Date       | Commit  | Status  |
| --- | ------------------------------------------------------ | ---------- | ------- | ------- |
| 001 | Expandir `.gitignore` (CONCERNS C1) — `.env.local` nunca vazou | 2026-04-13 | pending | ✅ Done |
| 002 | Consolidar `extractHighestIncome` em 5 arquivos (CONCERNS C3) | 2026-04-13 | pending | ✅ Done |
| 003 | Criar `vercel.json` com cron sync-campaigns (CONCERNS C13) | 2026-04-13 | pending | ✅ Done |
| 004 | Segregar `WEBHOOK_SECRET` de `CRON_SECRET` com fallback (CONCERNS C6) | 2026-04-13 | pending | ✅ Done (ops pendente) |
| 005 | Fix contrato `/api/admin/insights` + drill-down qualificados por adset/ad | 2026-04-13 | a37b24a | ✅ Done |

---

## Deferred Ideas

- [ ] Expansão de dashboard `/admin` com novas visões — Captured during: bootstrap 2026-04-13 (aguardando input do time de marketing)
- [ ] Integração WhatsApp para leads `qualified` — Captured during: bootstrap 2026-04-13
- [ ] Exportação CSV de leads — Captured during: bootstrap 2026-04-13
- [ ] Playwright e2e no fluxo webhook → admin — Captured during: bootstrap 2026-04-13

---

## Todos

- [x] ~~Q1: `.gitignore` completo~~ (`.specs/quick/001-gitignore/`)
- [x] ~~Q2: Consolidar `extractHighestIncome`~~ (`.specs/quick/002-dedup-extract-income/`)
- [x] ~~Q3: Criar `vercel.json` com crons~~ (`.specs/quick/003-vercel-json-crons/`)
- [x] ~~Q4: Segregar `WEBHOOK_SECRET`~~ — server OK; ops pendente (`.specs/quick/004-split-webhook-secret/`)
- [ ] **Ops (Q4):** gerar `WEBHOOK_SECRET` aleatório, setar em Vercel, atualizar 3 Apps Scripts, rotacionar também `CRON_SECRET` (está em curl do README)
- [x] ~~**Apps Script bug** income/position concatenados~~ — helper adicionado em `public/script-mentoria-aovivo-{2,3}.js` + 10 leads backfillados (`.specs/features/f-apps-script-split-income-position/`). **Você precisa colar o novo código nos 2 projetos Apps Script do Google manualmente** (passos no SUMMARY).
- [ ] **Calendários nos menus admin** — date range picker global + filtragem por período em dashboard, leads, ads, campaigns, ads/alertas
- [x] ~~F1: Dedup `event_id` Pixel↔CAPI — DEPLOYADA EM PROD~~. Zero duplicatas pré-existentes (1217 rows escaneadas). UNIQUE INDEX criado, smoke test confirmou dedup (id duplicado POSTado → 1 row no DB). Validação Meta Events Manager pendente em uso real.
- [x] ~~F2: Zod schemas em `fetchCampaigns`~~ (`.specs/features/f2-zod-meta-responses/`). Insights route fica para entrega futura.
- [x] ~~F3: Vitest + 52 testes em qualification/validation/capi~~ (`.specs/features/f3-vitest-critical-tests/`). Cobertura em marketing-api/tracking/integration fica para iteração futura.
- [x] ~~F4: Logger pino estruturado~~ (`.specs/features/f4-pino-logger/`). Todas as rotas server-side migradas; deploy + verificação Vercel Logs pendentes.
- [ ] F5: Rate limit `/api/tracking` — **adiado**. Alternativa leve: Vercel Firewall (rate limit por IP no dashboard, sem código). Decidir depois se tráfego abusivo aparecer.
- [x] ~~F6: Cron de cleanup `tracking_cache` (TTL 7 dias)~~ (`.specs/features/f6-cleanup-tracking-cache/`). Vercel Cron daily 03:00 UTC.

---

## Preferences

**Model Guidance Shown:** never
