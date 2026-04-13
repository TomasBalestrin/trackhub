"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { extractHighestIncome, isQualifiedIncome } from "@/lib/lead/qualification";
import { filterByDateRange } from "@/lib/date-range";
import { useSharedDateRange } from "@/hooks/useSharedDateRange";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import type { MetaCampaignCache } from "@/types/lead";

interface LeadData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  campaign_name: string | null;
  ad_name: string | null;
  adset_name: string | null;
  qualification_score: number;
  monthly_income: string | null;
  position: string | null;
  source: string | null;
  status: string;
  created_at: string;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  _adId?: string | null;
  _adsetId?: string | null;
}

interface CampaignGroup {
  campaign_name: string;
  campaign_id: string;
  status: string;
  objective: string | null;
  daily_budget: number | null;
  ads: MetaCampaignCache[];
  leads: LeadData[];
  qualified_leads: number;
  total_leads: number;
  avg_score: number;
  top_position: string;
  top_income: string;
}

interface InsightsRow {
  campaign_name?: string;
  campaign_id?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  cpc?: string;
  ctr?: string;
  reach?: string;
  leads?: number;
  cost_per_lead?: number;
}

interface AdsetInsightRow {
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  leads?: number;
  cost_per_lead?: number;
}

interface AdInsightRow {
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
  leads?: number;
  cost_per_lead?: number;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
}

interface AdsetRow {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  status: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  bid_strategy: string | null;
  optimization_goal: string | null;
  billing_event: string | null;
  targeting: {
    age_min: number | null;
    age_max: number | null;
    genders: string[];
    geo_countries: string[];
    geo_regions: string[];
    geo_cities: string[];
    interests_count: number;
    behaviors_count: number;
    custom_audiences_count: number;
  } | null;
  start_time: string | null;
  end_time: string | null;
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "ACTIVE", label: "Ativas" },
  { value: "PAUSED", label: "Pausadas" },
  { value: "DELETED", label: "Desativadas" },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignGroup[]>([]);
  const [adsets, setAdsets] = useState<AdsetRow[]>([]);
  const [adsetInsights, setAdsetInsights] = useState<AdsetInsightRow[]>([]);
  const [adInsights, setAdInsights] = useState<AdInsightRow[]>([]);
  const [insights, setInsights] = useState<InsightsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [expandedAdset, setExpandedAdset] = useState<string | null>(null);
  const [dateRange, setDateRange] = useSharedDateRange();
  const { formatBRL } = useExchangeRate();

  useEffect(() => {
    loadData();
    loadInsights();
  }, [dateRange.start, dateRange.end]);

  useAutoRefresh(() => {
    loadData();
    loadInsights();
  }, 60_000);

  async function loadData() {
    const res = await fetch("/api/admin/campaigns");
    const data = await res.json();

    const campaignsData = (data.campaigns || []) as MetaCampaignCache[];
    const adsetsData = (data.adsets || []) as AdsetRow[];
    setAdsets(adsetsData);
    const rawLeads = (data.leads || []) as LeadData[];
    // Filtra leads pelo período escolhido antes de agrupar por campanha.
    const leadsData = filterByDateRange(rawLeads, dateRange);

    // Build name → { ad_id, adset_id } map from cache so we can attribute
    // leads via ad_name OR utm_content even when lead.adset_name is null.
    const adByName = new Map<string, { ad_id: string | null; adset_id: string | null }>();
    campaignsData.forEach((c) => {
      if (c.ad_name) adByName.set(c.ad_name.trim().toLowerCase(), { ad_id: c.ad_id, adset_id: c.adset_id });
    });
    const adsetByName = new Map<string, string>();
    adsetsData.forEach((a) => {
      if (a.adset_name) adsetByName.set(a.adset_name.trim().toLowerCase(), a.adset_id);
    });

    function deriveLeadIds(lead: LeadData): { adId: string | null; adsetId: string | null } {
      const candidates = [lead.ad_name, lead.utm_content].filter(Boolean) as string[];
      for (const name of candidates) {
        const hit = adByName.get(name.trim().toLowerCase());
        if (hit) return { adId: hit.ad_id, adsetId: hit.adset_id };
      }
      // Fallback: only adset_name match
      if (lead.adset_name) {
        const aid = adsetByName.get(lead.adset_name.trim().toLowerCase());
        if (aid) return { adId: null, adsetId: aid };
      }
      return { adId: null, adsetId: null };
    }

    // Group by campaign_name
    const grouped: Record<string, CampaignGroup> = {};

    campaignsData.forEach((c) => {
      const name = c.campaign_name || "Sem nome";
      if (!grouped[name]) {
        grouped[name] = {
          campaign_name: name,
          campaign_id: c.campaign_id,
          status: c.status || "UNKNOWN",
          objective: c.objective,
          daily_budget: c.daily_budget,
          ads: [],
          leads: [],
          qualified_leads: 0,
          total_leads: 0,
          avg_score: 0,
          top_position: "N/A",
          top_income: "N/A",
        };
      }
      grouped[name].ads.push(c);
      // Use most relevant status (ACTIVE > PAUSED > others)
      if (c.status === "ACTIVE") grouped[name].status = "ACTIVE";
    });

    // Assign leads to campaigns + derive ad_id/adset_id from name map
    leadsData.forEach((lead) => {
      const { adId, adsetId } = deriveLeadIds(lead);
      lead._adId = adId;
      lead._adsetId = adsetId;
      const name = lead.campaign_name || lead.utm_campaign || "";
      if (grouped[name]) {
        grouped[name].leads.push(lead);
      }
    });

    // Compute stats
    Object.values(grouped).forEach((g) => {
      g.total_leads = g.leads.length;
      g.qualified_leads = g.leads.filter(
        (l) => isQualifiedIncome(l.monthly_income)
      ).length;

      if (g.leads.length > 0) {
        g.avg_score = Math.round(
          g.leads.reduce((sum, l) => sum + l.qualification_score, 0) / g.leads.length
        );

        // Most common position
        const positions: Record<string, number> = {};
        g.leads.forEach((l) => {
          if (l.position) positions[l.position] = (positions[l.position] || 0) + 1;
        });
        const topPos = Object.entries(positions).sort((a, b) => b[1] - a[1])[0];
        if (topPos) g.top_position = topPos[0];

        // Most common income range
        const incomes: Record<string, number> = {};
        g.leads.forEach((l) => {
          if (l.monthly_income) incomes[l.monthly_income] = (incomes[l.monthly_income] || 0) + 1;
        });
        const topInc = Object.entries(incomes).sort((a, b) => b[1] - a[1])[0];
        if (topInc) g.top_income = topInc[0];
      }
    });

    const sorted = Object.values(grouped).sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
      if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1;
      return b.total_leads - a.total_leads;
    });

    setCampaigns(sorted);
    setLoading(false);
  }

  async function loadInsights() {
    try {
      const range = dateRange.start && dateRange.end
        ? `since=${encodeURIComponent(dateRange.start)}&until=${encodeURIComponent(dateRange.end)}`
        : "date_preset=last_30d";
      const [campaignRes, adsetRes, adRes] = await Promise.all([
        fetch(`/api/admin/insights?type=campaigns&${range}`),
        fetch(`/api/admin/insights?type=adsets&${range}`),
        fetch(`/api/admin/insights?type=ads&${range}`),
      ]);
      const campaignData = await campaignRes.json();
      const adsetData = await adsetRes.json();
      const adData = await adRes.json();
      setInsights(campaignData.data || []);
      setAdsetInsights(adsetData.data || []);
      setAdInsights(adData.data || []);
    } catch {
      setInsights([]);
      setAdsetInsights([]);
      setAdInsights([]);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/campaigns", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncResult(
          `Sincronizado: ${data.ads_upserted}/${data.ads_total} anúncios · ${data.adsets_upserted}/${data.adsets_total} adsets`
        );
        loadData();
      } else {
        setSyncResult("Erro: " + (data.error || "falha desconhecida"));
      }
    } catch {
      setSyncResult("Erro de conexão");
    }
    setSyncing(false);
  }

  function getInsight(campaignName: string): InsightsRow | null {
    return insights.find((i) => i.campaign_name === campaignName) || null;
  }

  function getAdsetInsight(adsetId: string): AdsetInsightRow | null {
    return adsetInsights.find((i) => i.adset_id === adsetId) || null;
  }

  function getAdInsight(adId: string | null): AdInsightRow | null {
    if (!adId) return null;
    return adInsights.find((i) => i.ad_id === adId) || null;
  }

  function getAdsetsForCampaign(campaignId: string): AdsetRow[] {
    return adsets.filter((a) => a.campaign_id === campaignId);
  }

  const filtered = campaigns.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.campaign_name.toLowerCase().includes(q);
    }
    return true;
  });

  // Summary KPIs
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const totalLeadsAll = campaigns.reduce((s, c) => s + c.total_leads, 0);
  const totalQualified = campaigns.reduce((s, c) => s + c.qualified_leads, 0);

  // Alerts
  const noLeadCampaigns = campaigns.filter(
    (c) => c.status === "ACTIVE" && c.total_leads === 0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-dark">Campanhas</h1>
          <p className="text-sm text-navy-50">Gestão e performance das campanhas Meta Ads</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-gold text-white text-sm font-semibold rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : "Sync Meta"}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="text-sm px-4 py-2 rounded-lg bg-info/10 text-info">{syncResult}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-navy-50">Total Campanhas</p>
          <p className="text-3xl font-bold text-navy-dark">{totalCampaigns}</p>
        </Card>
        <Card>
          <p className="text-sm text-navy-50">Ativas</p>
          <p className="text-3xl font-bold text-success">{activeCampaigns}</p>
        </Card>
        <Card>
          <p className="text-sm text-navy-50">Leads Capturados</p>
          <p className="text-3xl font-bold text-gold">{totalLeadsAll}</p>
        </Card>
        <Card>
          <p className="text-sm text-navy-50">Qualificados (30k+)</p>
          <p className="text-3xl font-bold text-success">
            {totalQualified}
            {totalLeadsAll > 0 && (
              <span className="text-sm font-normal text-navy-50 ml-2">
                ({Math.round((totalQualified / totalLeadsAll) * 100)}%)
              </span>
            )}
          </p>
        </Card>
      </div>

      {/* Alerts */}
      {noLeadCampaigns.length > 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="text-warning text-xl">&#9888;</span>
            <div>
              <p className="text-sm font-semibold text-navy-dark">
                {noLeadCampaigns.length} campanha(s) ativa(s) sem leads
              </p>
              <p className="text-xs text-navy-50 mt-1">
                {noLeadCampaigns.map((c) => c.campaign_name).join(", ")}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="w-72">
          <Input
            placeholder="Buscar campanha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Campaign List */}
      <div className="space-y-4">
        {filtered.map((campaign) => {
          const insight = getInsight(campaign.campaign_name);
          const isExpanded = expandedCampaign === campaign.campaign_name;

          return (
            <div key={campaign.campaign_name} className={`rounded-[var(--radius-lg)] overflow-hidden bg-white transition-all ${isExpanded ? "shadow-[var(--shadow-md)] ring-2 ring-gold" : "shadow-[var(--shadow-sm)]"}`}>
              {/* Campaign Header */}
              <button
                onClick={() => setExpandedCampaign(isExpanded ? null : campaign.campaign_name)}
                className={`w-full text-left p-5 transition-colors ${isExpanded ? "bg-gold/5" : "hover:bg-gray-50"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-navy-50 transition-transform ${isExpanded ? "rotate-90 text-gold" : ""}`}>▶</span>
                      <h3 className="text-base font-semibold text-navy-dark">{campaign.campaign_name}</h3>
                      <Badge variant={campaign.status === "ACTIVE" ? "success" : campaign.status === "PAUSED" ? "warning" : "default"}>
                        {campaign.status === "ACTIVE" ? "Ativa" : campaign.status === "PAUSED" ? "Pausada" : "Desativada"}
                      </Badge>
                      {campaign.qualified_leads > 0 && (
                        <Badge variant="gold">{campaign.qualified_leads} qualificados</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-navy-50">
                      <span>{campaign.ads.length} anúncio(s)</span>
                      {campaign.objective && <span>Objetivo: {campaign.objective}</span>}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-navy-50">Leads</p>
                      <p className="text-lg font-bold text-navy-dark">{campaign.total_leads}</p>
                    </div>
                    {insight && (
                      <>
                        <div>
                          <p className="text-xs text-navy-50">Gasto</p>
                          <p className="text-lg font-bold text-navy-dark">
                            {formatBRL(parseFloat(insight.spend || "0"))}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-navy-50">CPL</p>
                          <p className={`text-lg font-bold ${insight.cost_per_lead && insight.cost_per_lead > 0 ? "text-navy-dark" : "text-navy-30"}`}>
                            {insight.cost_per_lead && insight.cost_per_lead > 0
                              ? formatBRL(insight.cost_per_lead)
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-navy-50">CTR</p>
                          <p className="text-lg font-bold text-navy-dark">
                            {parseFloat(insight.ctr || "0").toFixed(2)}%
                          </p>
                        </div>
                      </>
                    )}
                    <svg
                      className={`w-5 h-5 text-navy-30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Performance Bar */}
                {insight && parseFloat(insight.impressions || "0") > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-navy-30 w-16">Impressões</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: `${Math.min(parseFloat(insight.ctr || "0") * 10, 100)}%` }} />
                    </div>
                    <span className="text-xs text-navy-50 w-20 text-right">{parseInt(insight.impressions || "0").toLocaleString()}</span>
                  </div>
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-5 space-y-6">
                  {/* Campaign Intelligence */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-navy-50">Score Médio</p>
                      <p className="text-xl font-bold text-navy-dark">{campaign.avg_score}/100</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-navy-50">Cargo Mais Comum</p>
                      <p className="text-sm font-semibold text-navy-dark">{campaign.top_position}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-navy-50">Renda Mais Comum</p>
                      <p className="text-sm font-semibold text-navy-dark truncate">{campaign.top_income}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-navy-50">Taxa Qualificação</p>
                      <p className="text-xl font-bold text-success">
                        {campaign.total_leads > 0 ? Math.round((campaign.qualified_leads / campaign.total_leads) * 100) : 0}%
                      </p>
                    </div>
                  </div>

                  {/* Adsets (conjuntos de anúncios) */}
                  {(() => {
                    const campaignAdsets = getAdsetsForCampaign(campaign.campaign_id);
                    if (campaignAdsets.length === 0) {
                      return (
                        <div>
                          <h4 className="text-sm font-semibold text-navy-dark mb-3">
                            Conjuntos de anúncios
                          </h4>
                          <p className="text-xs text-navy-50">
                            Nenhum adset em cache. Clique em <strong>Sync Meta</strong> no topo para importar.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-navy-dark mb-3">
                          Conjuntos de anúncios ({campaignAdsets.length})
                        </h4>
                        <div className="space-y-2">
                          {campaignAdsets.map((adset) => {
                            const ai = getAdsetInsight(adset.adset_id);
                            const adsInAdset = campaign.ads.filter((ad) => ad.adset_id === adset.adset_id);
                            const isAdsetExpanded = expandedAdset === adset.adset_id;
                            const leadsInAdset = campaign.leads.filter(
                              (l) => l._adsetId === adset.adset_id
                            );
                            const qualifiedInAdset = leadsInAdset.filter((l) =>
                              isQualifiedIncome(l.monthly_income)
                            ).length;
                            // Prioriza leads do nosso DB (matched por _adsetId) sobre
                            // a contagem da Meta — em campanhas OFFSITE_CONVERSIONS a
                            // Meta não reporta "lead" no nível de adset.
                            const leadsApi = ai?.leads ?? 0;
                            const leadsCount = leadsInAdset.length || leadsApi;
                            const spend = ai ? parseFloat(ai.spend || "0") : 0;
                            const cpl = leadsCount > 0 ? spend / leadsCount : (ai?.cost_per_lead ?? 0);
                            const ctr = ai ? parseFloat(ai.ctr || "0") : 0;
                            return (
                              <div key={adset.adset_id} className={`rounded-md overflow-hidden transition-all ${isAdsetExpanded ? "border-2 border-gold shadow-[var(--shadow-sm)]" : "border border-gray-200"}`}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedAdset(isAdsetExpanded ? null : adset.adset_id)
                                  }
                                  className={`w-full text-left px-3 py-2 transition-colors ${isAdsetExpanded ? "bg-gold/10" : "bg-gray-50 hover:bg-gray-100"}`}
                                >
                                  <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="flex-1 min-w-[200px]">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs transition-transform inline-block ${isAdsetExpanded ? "rotate-90 text-gold" : "text-navy-50"}`}>▶</span>
                                        <span className="text-sm font-semibold text-navy-dark">
                                          {adset.adset_name}
                                        </span>
                                        <Badge
                                          variant={
                                            adset.status === "ACTIVE"
                                              ? "success"
                                              : adset.status === "PAUSED"
                                              ? "warning"
                                              : "default"
                                          }
                                        >
                                          {adset.status === "ACTIVE"
                                            ? "Ativo"
                                            : adset.status === "PAUSED"
                                            ? "Pausado"
                                            : adset.status || "N/A"}
                                        </Badge>
                                        {qualifiedInAdset > 0 && (
                                          <Badge variant="gold">
                                            {qualifiedInAdset} qualif. (30k+)
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-navy-50">
                                        <span>{adsInAdset.length} anúncio(s)</span>
                                        {adset.daily_budget != null && (
                                          <span>Budget diário: {formatBRL(adset.daily_budget)}</span>
                                        )}
                                        {adset.lifetime_budget != null && (
                                          <span>Budget total: {formatBRL(adset.lifetime_budget)}</span>
                                        )}
                                        {adset.optimization_goal && (
                                          <span>Meta: {adset.optimization_goal}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-right shrink-0">
                                      <div className="w-14">
                                        <p className="text-xs text-navy-50">Qualif</p>
                                        <p className={`text-sm font-bold ${qualifiedInAdset > 0 ? "text-gold" : "text-navy-30"}`}>
                                          {qualifiedInAdset}
                                        </p>
                                      </div>
                                      <div className="w-14">
                                        <p className="text-xs text-navy-50">Leads</p>
                                        <p className="text-sm font-bold text-navy-dark">{leadsCount}</p>
                                      </div>
                                      <div className="w-24">
                                        <p className="text-xs text-navy-50">Gasto</p>
                                        <p className="text-sm font-bold text-navy-dark">
                                          {spend > 0 ? formatBRL(spend) : "—"}
                                        </p>
                                      </div>
                                      <div className="w-20">
                                        <p className="text-xs text-navy-50">CPL</p>
                                        <p className="text-sm font-bold text-navy-dark">
                                          {cpl > 0 ? formatBRL(cpl) : "—"}
                                        </p>
                                      </div>
                                      <div className="w-16">
                                        <p className="text-xs text-navy-50">CTR</p>
                                        <p className="text-sm font-bold text-navy-dark">
                                          {ctr.toFixed(2)}%
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </button>

                                {isAdsetExpanded && (
                                  <div className="p-3 bg-white space-y-3">
                                    {/* Targeting summary */}
                                    {adset.targeting && (
                                      <div>
                                        <p className="text-xs font-semibold text-navy-70 mb-2">
                                          Segmentação
                                        </p>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                          {(adset.targeting.age_min || adset.targeting.age_max) && (
                                            <Badge variant="default">
                                              Idade {adset.targeting.age_min ?? "?"}–
                                              {adset.targeting.age_max ?? "?"}
                                            </Badge>
                                          )}
                                          {adset.targeting.genders.length > 0 && (
                                            <Badge variant="default">
                                              {adset.targeting.genders.join("/")}
                                            </Badge>
                                          )}
                                          {adset.targeting.geo_countries.length > 0 && (
                                            <Badge variant="default">
                                              {adset.targeting.geo_countries.join(", ")}
                                            </Badge>
                                          )}
                                          {adset.targeting.geo_regions.length > 0 && (
                                            <Badge variant="default">
                                              {adset.targeting.geo_regions.slice(0, 3).join(", ")}
                                              {adset.targeting.geo_regions.length > 3 && " +"}
                                            </Badge>
                                          )}
                                          {adset.targeting.geo_cities.length > 0 && (
                                            <Badge variant="default">
                                              {adset.targeting.geo_cities.slice(0, 3).join(", ")}
                                              {adset.targeting.geo_cities.length > 3 && " +"}
                                            </Badge>
                                          )}
                                          {adset.targeting.interests_count > 0 && (
                                            <Badge variant="default">
                                              {adset.targeting.interests_count} interesse(s)
                                            </Badge>
                                          )}
                                          {adset.targeting.behaviors_count > 0 && (
                                            <Badge variant="default">
                                              {adset.targeting.behaviors_count} comportamento(s)
                                            </Badge>
                                          )}
                                          {adset.targeting.custom_audiences_count > 0 && (
                                            <Badge variant="default">
                                              {adset.targeting.custom_audiences_count} públic. custom.
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Bid / billing info */}
                                    {(adset.bid_strategy || adset.billing_event) && (
                                      <div className="text-xs text-navy-50 flex gap-4">
                                        {adset.bid_strategy && (
                                          <span>Bid: {adset.bid_strategy}</span>
                                        )}
                                        {adset.billing_event && (
                                          <span>Cobrança: {adset.billing_event}</span>
                                        )}
                                      </div>
                                    )}

                                    {/* Ads inside this adset */}
                                    <div>
                                      <p className="text-xs font-semibold text-navy-70 mb-2">
                                        Anúncios ({adsInAdset.length})
                                      </p>
                                      {adsInAdset.length === 0 ? (
                                        <p className="text-xs text-navy-30">Nenhum anúncio nesse conjunto.</p>
                                      ) : (
                                        <>
                                        <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                              <th className="text-left px-3 py-2 font-medium text-navy-70">Anúncio</th>
                                              <th className="text-left px-3 py-2 font-medium text-navy-70">Tipo</th>
                                              <th className="text-left px-3 py-2 font-medium text-navy-70">Status</th>
                                              <th className="text-right px-3 py-2 font-medium text-navy-70">Qualif</th>
                                              <th className="text-right px-3 py-2 font-medium text-navy-70">Leads</th>
                                              <th className="text-right px-3 py-2 font-medium text-navy-70">Impr.</th>
                                              <th className="text-right px-3 py-2 font-medium text-navy-70">Gasto</th>
                                              <th className="text-right px-3 py-2 font-medium text-navy-70">CTR</th>
                                              <th className="text-right px-3 py-2 font-medium text-navy-70">CPL</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {adsInAdset.map((ad) => {
                                              const leadsInAd = leadsInAdset.filter(
                                                (l) => l._adId === ad.ad_id
                                              );
                                              const qualifiedInAd = leadsInAd.filter((l) =>
                                                isQualifiedIncome(l.monthly_income)
                                              ).length;
                                              const adi = getAdInsight(ad.ad_id);
                                              const adImpressions = adi ? parseInt(adi.impressions || "0", 10) : 0;
                                              const adSpend = adi ? parseFloat(adi.spend || "0") : 0;
                                              const adCtr = adi ? parseFloat(adi.ctr || "0") : 0;
                                              const adLeadsApi = adi?.leads ?? 0;
                                              const adLeadsCount = leadsInAd.length || adLeadsApi;
                                              const adCpl = adLeadsCount > 0 ? adSpend / adLeadsCount : (adi?.cost_per_lead ?? 0);
                                              return (
                                                <tr key={ad.id} className="border-b border-gray-50">
                                                  <td className="px-3 py-2 text-navy-dark font-medium">
                                                    {ad.ad_name || "N/A"}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <Badge variant={ad.creative_type === "VIDEO" ? "info" : "default"}>
                                                      {ad.creative_type || "N/A"}
                                                    </Badge>
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <Badge variant={ad.status === "ACTIVE" ? "success" : "default"}>
                                                      {ad.status || "N/A"}
                                                    </Badge>
                                                  </td>
                                                  <td className={`px-3 py-2 text-right font-bold ${qualifiedInAd > 0 ? "text-gold" : "text-navy-30"}`}>
                                                    {qualifiedInAd}
                                                  </td>
                                                  <td className="px-3 py-2 text-right text-navy-70">
                                                    {adLeadsCount}
                                                    {leadsInAd.length > 0 && adLeadsApi > 0 && adLeadsApi !== leadsInAd.length && (
                                                      <span className="text-xs text-navy-30 ml-1">
                                                        ({adLeadsApi} api)
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="px-3 py-2 text-right text-navy-70">
                                                    {adImpressions > 0 ? adImpressions.toLocaleString("pt-BR") : "—"}
                                                  </td>
                                                  <td className="px-3 py-2 text-right text-navy-70">
                                                    {adSpend > 0 ? formatBRL(adSpend) : "—"}
                                                  </td>
                                                  <td className="px-3 py-2 text-right text-navy-70">
                                                    {adCtr > 0 ? `${adCtr.toFixed(2)}%` : "—"}
                                                  </td>
                                                  <td className="px-3 py-2 text-right text-navy-70">
                                                    {adCpl > 0 ? formatBRL(adCpl) : "—"}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                        </div>

                                        {qualifiedInAdset > 0 && (
                                          <div className="mt-3">
                                            <p className="text-xs font-semibold text-navy-70 mb-2">
                                              Leads qualificados (30k+) neste conjunto
                                            </p>
                                            <div className="space-y-1">
                                              {leadsInAdset
                                                .filter((l) => isQualifiedIncome(l.monthly_income))
                                                .map((l) => (
                                                  <div
                                                    key={l.id}
                                                    className="flex items-center justify-between text-xs bg-success/5 px-3 py-1.5 rounded"
                                                  >
                                                    <a
                                                      href={`/admin/leads/${l.id}`}
                                                      className="text-navy-dark font-medium hover:text-gold"
                                                    >
                                                      {l.full_name}
                                                    </a>
                                                    <span className="text-success font-semibold">
                                                      {l.monthly_income}
                                                    </span>
                                                    <span className="text-navy-50 truncate max-w-[200px]">
                                                      {l.ad_name || "—"}
                                                    </span>
                                                  </div>
                                                ))}
                                            </div>
                                          </div>
                                        )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Leads Table */}
                  {campaign.leads.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-navy-dark mb-3">
                        Leads ({campaign.total_leads})
                        {campaign.qualified_leads > 0 && (
                          <span className="text-success font-normal ml-2">
                            ({campaign.qualified_leads} qualificados)
                          </span>
                        )}
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Nome</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Renda</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Cargo</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Score</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Status</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Anúncio</th>
                              <th className="text-left px-3 py-2 font-medium text-navy-70">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaign.leads
                              .sort((a, b) => b.qualification_score - a.qualification_score)
                              .map((lead) => {
                                const isQualified = isQualifiedIncome(lead.monthly_income);
                                return (
                                  <tr key={lead.id} className={`border-b border-gray-50 ${isQualified ? "bg-success/5" : ""}`}>
                                    <td className="px-3 py-2">
                                      <a href={`/admin/leads/${lead.id}`} className="text-navy-dark font-medium hover:text-gold transition-colors">
                                        {lead.full_name}
                                      </a>
                                      <p className="text-xs text-navy-30">{lead.email}</p>
                                    </td>
                                    <td className={`px-3 py-2 text-sm ${isQualified ? "text-success font-semibold" : "text-navy-70"}`}>
                                      {lead.monthly_income || "N/A"}
                                    </td>
                                    <td className="px-3 py-2 text-navy-70">{lead.position || "N/A"}</td>
                                    <td className="px-3 py-2">
                                      <span className="font-semibold text-navy-dark">{lead.qualification_score}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                      <Badge variant={lead.status === "converted" ? "success" : lead.status === "new" ? "info" : "default"}>
                                        {lead.status}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-navy-50 max-w-[150px] truncate">
                                      {lead.ad_name || lead.utm_content || "—"}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-navy-50">{formatDate(lead.created_at)}</td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {campaign.leads.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-sm text-navy-30">Nenhum lead capturado por esta campanha</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <Card>
            <p className="text-navy-50 text-center py-8">Nenhuma campanha encontrada.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
