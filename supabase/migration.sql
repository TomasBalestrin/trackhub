-- =============================================
-- Bethel Track - Migration SQL
-- Executar no SQL Editor do Supabase
-- =============================================

-- Tabela de perfis (admin/manager para o dashboard)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'manager'))
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- Tabela principal de leads
-- =============================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Dados pessoais
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  monthly_income TEXT,
  city TEXT,
  state TEXT,
  how_found TEXT,

  -- UTM tracking
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,

  -- Meta Ads identifiers
  fbclid TEXT,
  ad_name TEXT,
  adset_name TEXT,
  campaign_name TEXT,
  creative_type TEXT,
  ad_id TEXT,
  adset_id TEXT,
  campaign_id TEXT,

  -- Tracking metadata
  landing_page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  fbc TEXT,
  fbp TEXT,

  -- Conversion timestamps
  page_view_at TIMESTAMPTZ,
  view_content_at TIMESTAMPTZ,
  lead_at TIMESTAMPTZ DEFAULT now(),
  complete_registration_at TIMESTAMPTZ,

  -- Lead qualification
  qualification_score INT DEFAULT 0,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  whatsapp_group_sent BOOLEAN DEFAULT false,

  -- Event IDs for Pixel <-> CAPI deduplication
  event_id_page_view TEXT,
  event_id_view_content TEXT,
  event_id_lead TEXT,
  event_id_complete_registration TEXT
);

CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_campaign_name ON leads(campaign_name);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_fbclid ON leads(fbclid);
CREATE INDEX idx_leads_qualification_score ON leads(qualification_score DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Service role pode inserir (API routes usam service role key)
-- Nao precisa de policy para service role - ele bypassa RLS

-- Admins podem ler leads
CREATE POLICY "Admins can read leads" ON leads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Admins podem atualizar leads
CREATE POLICY "Admins can update leads" ON leads
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- =============================================
-- Tabela de eventos de tracking
-- =============================================
CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_source TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  fbclid TEXT,
  fbc TEXT,
  fbp TEXT,
  ip_address INET,
  user_agent TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  capi_sent BOOLEAN DEFAULT false,
  capi_response JSONB
);

CREATE INDEX idx_tracking_events_lead_id ON tracking_events(lead_id);
CREATE INDEX idx_tracking_events_event_name ON tracking_events(event_name);
CREATE INDEX idx_tracking_events_created_at ON tracking_events(created_at DESC);

ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read tracking events" ON tracking_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- =============================================
-- Cache de campanhas Meta
-- =============================================
CREATE TABLE IF NOT EXISTS meta_campaigns_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  campaign_id TEXT UNIQUE NOT NULL,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  creative_type TEXT,
  creative_thumbnail_url TEXT,
  status TEXT,
  daily_budget NUMERIC,
  objective TEXT,
  raw_data JSONB
);

CREATE INDEX idx_meta_campaigns_cache_campaign_id ON meta_campaigns_cache(campaign_id);

ALTER TABLE meta_campaigns_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read campaigns cache" ON meta_campaigns_cache
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- =============================================
-- Funcao para atualizar updated_at automaticamente
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
