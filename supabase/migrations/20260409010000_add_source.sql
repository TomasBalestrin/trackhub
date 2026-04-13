-- Adiciona campo source para identificar origem do lead (qual site/planilha)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
