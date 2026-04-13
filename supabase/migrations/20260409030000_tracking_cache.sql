-- Cache de dados de tracking para enriquecer leads que chegam via webhook
-- O tracker.js envia UTMs/fbclid quando o form é submetido
-- O webhook busca esses dados ao criar o lead

CREATE TABLE tracking_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  email TEXT NOT NULL,
  tracking_data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_tracking_cache_email ON tracking_cache(email);

-- Limpar entradas com mais de 7 dias automaticamente (cleanup via cron ou manual)
-- As entradas são consultadas e deletadas quando o lead é criado

-- RLS: apenas service role pode ler/escrever
ALTER TABLE tracking_cache ENABLE ROW LEVEL SECURITY;
