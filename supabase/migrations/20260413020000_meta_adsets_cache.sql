-- F-adset-drilldown: cache por adset (conjuntos de anúncios Meta).
--
-- meta_campaigns_cache continua como está (1 linha por AD, útil para
-- agrupar criativos). Nova tabela armazena o nível intermediário —
-- metadados imutáveis de configuração (budget, targeting summary,
-- bid strategy) que o endpoint /insights não entrega.
--
-- Métricas de performance por adset (spend, leads, etc) vêm sob demanda
-- de /insights?level=adset — não persistimos pra não duplicar a fonte
-- autoritativa do Meta.

CREATE TABLE IF NOT EXISTS public.meta_adsets_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adset_id text NOT NULL UNIQUE,
  adset_name text NOT NULL,
  campaign_id text NOT NULL,
  status text,
  daily_budget numeric,          -- em reais (Meta devolve em centavos; dividimos antes de gravar)
  lifetime_budget numeric,
  bid_strategy text,
  optimization_goal text,
  billing_event text,
  targeting jsonb,               -- resumo estruturado (ver summarizeTargeting)
  start_time timestamptz,
  end_time timestamptz,
  raw_data jsonb,                -- payload bruto do Graph API para inspeção futura
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_adsets_cache_campaign
  ON public.meta_adsets_cache (campaign_id);
