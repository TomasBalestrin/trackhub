# State

**Last Updated:** 2026-04-13
**Current Work:** Quick tasks Q1–Q4 concluídas; próximo: F1 (dedup Pixel/CAPI).

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
- [ ] F1: Auditar e corrigir dedup `event_id` Pixel↔CAPI (prioridade imediata)
- [ ] F2: Zod schemas para respostas Meta Marketing API (CONCERNS C10)

---

## Preferences

**Model Guidance Shown:** never
