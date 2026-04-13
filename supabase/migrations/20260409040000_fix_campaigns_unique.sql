-- Mudar a chave única de campaign_id para ad_id
-- para que cada anúncio seja um registro separado

ALTER TABLE meta_campaigns_cache DROP CONSTRAINT meta_campaigns_cache_campaign_id_key;
ALTER TABLE meta_campaigns_cache ADD CONSTRAINT meta_campaigns_cache_ad_id_key UNIQUE (ad_id);
