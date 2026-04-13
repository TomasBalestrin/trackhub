-- F1 — Dedup Pixel↔CAPI (spec: .specs/features/f1-dedup-pixel-capi/spec.md)
--
-- Adiciona UNIQUE INDEX em tracking_events.event_id para garantir que a
-- mesma conversão (mesmo event_id) nunca gere mais de uma linha, mesmo
-- com retries ou duplicação de caminhos client/server.
--
-- Pré-requisito: rodar a query de inspeção antes para confirmar que não
-- há duplicatas existentes. Se houver, esta migration FALHARÁ (esperado).
-- Resolver manualmente antes de re-aplicar:
--
--   SELECT event_id, COUNT(*)
--   FROM tracking_events
--   GROUP BY event_id
--   HAVING COUNT(*) > 1;
--
-- CONCURRENTLY evita lock de escrita na tabela durante a criação do índice
-- (importante em produção com tráfego contínuo).

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS tracking_events_event_id_key
  ON public.tracking_events (event_id);
