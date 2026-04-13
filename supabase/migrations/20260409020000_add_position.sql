-- Adiciona campo position para guardar cargo/posicao do lead (Dono, Socio, etc)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS position TEXT;
