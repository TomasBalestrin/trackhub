# State

**Last Updated:** 2026-04-13
**Current Work:** F1 + F2 implementadas; deploy manual F1 + teste pós-deploy pendentes.

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

_(nenhum no momento)_

---

## Lessons Learned

_(a popular conforme o trabalho avança)_

---

## Quick Tasks Completed

| #   | Description                                            | Date       | Commit  | Status  |
| --- | ------------------------------------------------------ | ---------- | ------- | ------- |
| 001 | Expandir `.gitignore` (CONCERNS C1) — `.env.local` nunca vazou | 2026-04-13 | pending | ✅ Done |
| 002 | Consolidar `extractHighestIncome` em 5 arquivos (CONCERNS C3) | 2026-04-13 | pending | ✅ Done |
| 003 | Criar `vercel.json` com cron sync-campaigns (CONCERNS C13) | 2026-04-13 | pending | ✅ Done |
| 004 | Segregar `WEBHOOK_SECRET` de `CRON_SECRET` com fallback (CONCERNS C6) | 2026-04-13 | pending | ✅ Done (ops pendente) |

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
- [x] ~~F1: Dedup `event_id` Pixel↔CAPI — código e migration prontos~~ (`.specs/features/f1-dedup-pixel-capi/`). **Deploy manual pendente:** inspecionar duplicatas, rodar migration, validar pós-deploy.
- [x] ~~F2: Zod schemas em `fetchCampaigns`~~ (`.specs/features/f2-zod-meta-responses/`). Insights route fica para entrega futura.

---

## Preferences

**Model Guidance Shown:** never
